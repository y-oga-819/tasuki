use parking_lot::Mutex;
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Arc;
use std::thread::JoinHandle;
use tokio::sync::oneshot;

use crate::error::TasukiError;

// ---- Response types (shared with frontend) ----

#[derive(Debug, Clone, Serialize)]
pub struct LspLocation {
    pub file_path: String,
    pub line: u32,
    pub character: u32,
    pub end_line: u32,
    pub end_character: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct DocumentSymbol {
    pub name: String,
    pub kind: String,
    pub file_path: String,
    pub start_line: u32,
    pub start_character: u32,
    pub end_line: u32,
    pub end_character: u32,
    pub children: Vec<DocumentSymbol>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CallHierarchyCall {
    pub name: String,
    pub kind: String,
    pub file_path: String,
    pub line: u32,
    pub character: u32,
    pub code_snippet: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MethodInspection {
    pub name: String,
    pub file_path: String,
    pub start_line: u32,
    pub end_line: u32,
    pub changed_lines: Vec<u32>,
    pub change_type: String,
    pub definition_code: String,
    pub callers: Vec<CallHierarchyCall>,
    pub callees: Vec<CallHierarchyCall>,
    pub hover_info: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct InspectorProgress {
    pub done: usize,
    pub total: usize,
}

// ---- Internal types ----

#[derive(Debug, Clone)]
pub struct ChangedLines {
    pub added: Vec<u32>,
    pub deleted: Vec<u32>,
}

#[derive(Debug, Clone)]
struct ChangedMethod {
    name: String,
    file_path: String,
    start_line: u32,
    end_line: u32,
    changed_lines: Vec<u32>,
    change_type: String,
}

// ---- LSP State ----

pub struct LspState {
    writer: Mutex<Option<ChildStdin>>,
    child: Mutex<Option<Child>>,
    reader_handle: Mutex<Option<JoinHandle<()>>>,
    alive: Mutex<bool>,
    pending: Arc<Mutex<HashMap<i64, oneshot::Sender<Value>>>>,
    next_id: Mutex<i64>,
    root_uri: Mutex<String>,
    opened_files: Mutex<HashSet<String>>,
}

impl LspState {
    pub fn new() -> Self {
        Self {
            writer: Mutex::new(None),
            child: Mutex::new(None),
            reader_handle: Mutex::new(None),
            alive: Mutex::new(false),
            pending: Arc::new(Mutex::new(HashMap::new())),
            next_id: Mutex::new(1),
            root_uri: Mutex::new(String::new()),
            opened_files: Mutex::new(HashSet::new()),
        }
    }

    pub fn is_alive(&self) -> bool {
        *self.alive.lock()
    }

    /// Start an LSP server for the given language.
    /// Safe to call concurrently — if already alive, returns Ok immediately.
    pub fn start(&self, language_id: &str, root_path: &str) -> Result<(), TasukiError> {
        // Re-check inside the lock to prevent TOCTOU race
        if *self.alive.lock() {
            return Ok(());
        }

        // Kill existing session (in case of partially initialized state)
        self.stop();

        let (cmd, args) = detect_lsp_command(language_id)
            .ok_or_else(|| TasukiError::Lsp(format!("No LSP server for language: {language_id}")))?;

        let mut child = Command::new(cmd)
            .args(&args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| TasukiError::Lsp(format!("Failed to start {cmd}: {e}")))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| TasukiError::Lsp("Failed to capture LSP stdin".to_string()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| TasukiError::Lsp("Failed to capture LSP stdout".to_string()))?;

        *self.writer.lock() = Some(stdin);
        *self.child.lock() = Some(child);
        *self.alive.lock() = true;

        let root_uri = format!("file://{root_path}");
        *self.root_uri.lock() = root_uri;

        // Background reader thread
        let pending = Arc::clone(&self.pending);
        let handle = std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            loop {
                match read_lsp_message(&mut reader) {
                    Ok(Some(msg)) => {
                        // If it has an `id` field, it's a response to a request
                        if let Some(id) = msg.get("id").and_then(|v| v.as_i64()) {
                            if let Some(sender) = pending.lock().remove(&id) {
                                let _ = sender.send(msg);
                            }
                        }
                        // Notifications (no id) are ignored
                    }
                    Ok(None) => break, // EOF
                    Err(_) => break,
                }
            }
        });

        *self.reader_handle.lock() = Some(handle);

        Ok(())
    }

    /// Send the initialize handshake and wait for the server to be ready.
    pub async fn initialize(&self) -> Result<(), TasukiError> {
        let root_uri = self.root_uri.lock().clone();

        let params = json!({
            "processId": std::process::id(),
            "rootUri": root_uri,
            "capabilities": {
                "textDocument": {
                    "callHierarchy": {
                        "dynamicRegistration": false
                    },
                    "documentSymbol": {
                        "dynamicRegistration": false,
                        "hierarchicalDocumentSymbolSupport": true
                    },
                    "hover": {
                        "dynamicRegistration": false,
                        "contentFormat": ["plaintext", "markdown"]
                    },
                    "definition": {
                        "dynamicRegistration": false
                    },
                    "references": {
                        "dynamicRegistration": false
                    }
                }
            },
            "workspaceFolders": [{
                "uri": root_uri,
                "name": "workspace"
            }]
        });

        let _result = self.send_request("initialize", params).await?;

        // Send initialized notification (no response expected)
        self.send_notification("initialized", json!({}));

        Ok(())
    }

    /// Get all symbols in a file.
    pub async fn document_symbols(
        &self,
        file_path: &str,
    ) -> Result<Vec<DocumentSymbol>, TasukiError> {
        let uri = path_to_uri(file_path, &self.root_uri.lock());
        self.open_document(file_path, &uri)?;

        let params = json!({
            "textDocument": { "uri": uri }
        });

        let result = self.send_request("textDocument/documentSymbol", params).await?;

        let symbols = result
            .get("result")
            .cloned()
            .unwrap_or(Value::Null);

        Ok(parse_document_symbols(&symbols, file_path))
    }

    /// Get hover info (type signature, docs) for a position.
    pub async fn hover(
        &self,
        file_path: &str,
        line: u32,
        character: u32,
    ) -> Result<Option<String>, TasukiError> {
        let uri = path_to_uri(file_path, &self.root_uri.lock());

        let params = json!({
            "textDocument": { "uri": uri },
            "position": { "line": line, "character": character }
        });

        let result = self.send_request("textDocument/hover", params).await?;

        let hover = result.get("result");
        if hover.is_none() || hover == Some(&Value::Null) {
            return Ok(None);
        }

        let contents = hover
            .and_then(|h| h.get("contents"));

        match contents {
            Some(Value::String(s)) => Ok(Some(s.clone())),
            Some(Value::Object(obj)) => {
                Ok(obj.get("value").and_then(|v| v.as_str()).map(|s| s.to_string()))
            }
            _ => Ok(None),
        }
    }

    /// Get call hierarchy items, then incoming calls.
    pub async fn incoming_calls(
        &self,
        file_path: &str,
        line: u32,
        character: u32,
    ) -> Result<Vec<CallHierarchyCall>, TasukiError> {
        let items = self.prepare_call_hierarchy(file_path, line, character).await?;
        if items.is_empty() {
            return Ok(vec![]);
        }

        let item = &items[0];
        let params = json!({ "item": item });
        let result = self
            .send_request("callHierarchy/incomingCalls", params)
            .await?;

        let calls = result.get("result").cloned().unwrap_or(Value::Null);
        Ok(parse_incoming_calls(&calls))
    }

    /// Get call hierarchy items, then outgoing calls.
    pub async fn outgoing_calls(
        &self,
        file_path: &str,
        line: u32,
        character: u32,
    ) -> Result<Vec<CallHierarchyCall>, TasukiError> {
        let items = self.prepare_call_hierarchy(file_path, line, character).await?;
        if items.is_empty() {
            return Ok(vec![]);
        }

        let item = &items[0];
        let params = json!({ "item": item });
        let result = self
            .send_request("callHierarchy/outgoingCalls", params)
            .await?;

        let calls = result.get("result").cloned().unwrap_or(Value::Null);
        Ok(parse_outgoing_calls(&calls))
    }

    /// Stop the LSP server.
    pub fn stop(&self) {
        *self.writer.lock() = None;

        if let Some(mut child) = self.child.lock().take() {
            let _ = child.kill();
            let _ = child.wait();
        }

        if let Some(handle) = self.reader_handle.lock().take() {
            let _ = handle.join();
        }

        self.pending.lock().clear();
        self.opened_files.lock().clear();
        *self.alive.lock() = false;
    }

    // ---- Diff analysis ----

    /// Match changed lines to document symbols to find affected methods.
    pub fn match_lines_to_symbols(
        file_path: &str,
        changed_lines: &ChangedLines,
        symbols: &[DocumentSymbol],
    ) -> Vec<ChangedMethod> {
        let mut methods: HashMap<String, ChangedMethod> = HashMap::new();

        // Flatten symbols to only function/method level
        let flat_symbols = flatten_function_symbols(symbols);

        let all_lines: Vec<(u32, &str)> = changed_lines
            .added
            .iter()
            .map(|&l| (l, "added"))
            .chain(changed_lines.deleted.iter().map(|&l| (l, "deleted")))
            .collect();

        for (line, change_type) in all_lines {
            for sym in &flat_symbols {
                if line >= sym.start_line && line <= sym.end_line {
                    let key = format!("{}:{}", sym.name, sym.start_line);
                    let entry = methods.entry(key).or_insert_with(|| ChangedMethod {
                        name: sym.name.clone(),
                        file_path: file_path.to_string(),
                        start_line: sym.start_line,
                        end_line: sym.end_line,
                        changed_lines: vec![],
                        change_type: change_type.to_string(),
                    });
                    if !entry.changed_lines.contains(&line) {
                        entry.changed_lines.push(line);
                    }
                    // If we have both added and deleted lines, it's "modified"
                    if entry.change_type != change_type {
                        entry.change_type = "modified".to_string();
                    }
                }
            }
        }

        let mut result: Vec<ChangedMethod> = methods.into_values().collect();
        result.sort_by_key(|m| (m.file_path.clone(), m.start_line));
        result
    }

    /// Run the full diff analysis pipeline from pre-extracted changed lines.
    /// The `on_progress` callback is invoked with (done, total) after each method is analyzed.
    pub async fn analyze_diff_from_changed<F>(
        &self,
        changed_files: &HashMap<String, ChangedLines>,
        root_path: &str,
        on_progress: F,
    ) -> Result<Vec<MethodInspection>, TasukiError>
    where
        F: Fn(usize, usize),
    {
        if changed_files.is_empty() {
            return Ok(vec![]);
        }

        let mut all_methods: Vec<ChangedMethod> = Vec::new();

        // Phase 1: Get document symbols for each file and match to changed lines
        for (file_path, changed_lines) in changed_files {
            let symbols = match self.document_symbols(file_path).await {
                Ok(syms) => syms,
                Err(_) => continue, // Skip files where LSP can't get symbols
            };

            let methods = Self::match_lines_to_symbols(file_path, changed_lines, &symbols);
            all_methods.extend(methods);
        }

        let total = all_methods.len();
        on_progress(0, total);

        // Phase 2: For each method, get definition code and call hierarchy
        let mut inspections: Vec<MethodInspection> = Vec::new();

        for (i, method) in all_methods.iter().enumerate() {
            // Read definition code from file
            let definition_code = read_method_code(root_path, &method.file_path, method.start_line, method.end_line);

            // Get callers and callees (use the method's start position)
            let callers = self
                .incoming_calls(&method.file_path, method.start_line, 0)
                .await
                .unwrap_or_default();

            let callees = self
                .outgoing_calls(&method.file_path, method.start_line, 0)
                .await
                .unwrap_or_default();

            let hover_info = self
                .hover(&method.file_path, method.start_line, 0)
                .await
                .unwrap_or(None);

            inspections.push(MethodInspection {
                name: method.name.clone(),
                file_path: method.file_path.clone(),
                start_line: method.start_line,
                end_line: method.end_line,
                changed_lines: method.changed_lines.clone(),
                change_type: method.change_type.clone(),
                definition_code,
                callers,
                callees,
                hover_info,
            });

            on_progress(i + 1, total);
        }

        Ok(inspections)
    }

    // ---- Internal helpers ----

    fn send_notification(&self, method: &str, params: Value) {
        let msg = json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });

        if let Err(e) = self.write_message(&msg) {
            eprintln!("[LSP] Failed to send notification {method}: {e}");
        }
    }

    async fn send_request(&self, method: &str, params: Value) -> Result<Value, TasukiError> {
        let id = {
            let mut next = self.next_id.lock();
            let id = *next;
            *next += 1;
            id
        };

        let msg = json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });

        let (tx, rx) = oneshot::channel();
        self.pending.lock().insert(id, tx);

        if let Err(e) = self.write_message(&msg) {
            // Clean up orphaned pending entry on write failure
            self.pending.lock().remove(&id);
            return Err(e);
        }

        // Timeout after 30 seconds to avoid indefinite hangs
        match tokio::time::timeout(std::time::Duration::from_secs(30), rx).await {
            Ok(Ok(val)) => {
                // Check for JSON-RPC error responses from the LSP server
                if let Some(error) = val.get("error") {
                    let code = error.get("code").and_then(Value::as_i64).unwrap_or_default();
                    let message = error
                        .get("message")
                        .and_then(Value::as_str)
                        .unwrap_or("Unknown LSP error");
                    return Err(TasukiError::Lsp(format!(
                        "LSP error on {method} (code={code}): {message}"
                    )));
                }
                Ok(val)
            }
            Ok(Err(_)) => {
                Err(TasukiError::Lsp(format!("LSP request {method} (id={id}) got no response")))
            }
            Err(_) => {
                self.pending.lock().remove(&id);
                Err(TasukiError::Lsp(format!("LSP request {method} (id={id}) timed out after 30s")))
            }
        }
    }

    fn write_message(&self, msg: &Value) -> Result<(), TasukiError> {
        let mut guard = self.writer.lock();
        if let Some(writer) = guard.as_mut() {
            let body = serde_json::to_string(msg)
                .map_err(|e| TasukiError::Lsp(format!("JSON serialize failed: {e}")))?;
            let header = format!("Content-Length: {}\r\n\r\n", body.len());

            writer
                .write_all(header.as_bytes())
                .map_err(|e| TasukiError::Lsp(format!("LSP write failed: {e}")))?;
            writer
                .write_all(body.as_bytes())
                .map_err(|e| TasukiError::Lsp(format!("LSP write failed: {e}")))?;
            writer
                .flush()
                .map_err(|e| TasukiError::Lsp(format!("LSP flush failed: {e}")))?;
            Ok(())
        } else {
            Err(TasukiError::Lsp("No active LSP session".to_string()))
        }
    }

    async fn prepare_call_hierarchy(
        &self,
        file_path: &str,
        line: u32,
        character: u32,
    ) -> Result<Vec<Value>, TasukiError> {
        let uri = path_to_uri(file_path, &self.root_uri.lock());

        let params = json!({
            "textDocument": { "uri": uri },
            "position": { "line": line, "character": character }
        });

        let result = self
            .send_request("textDocument/prepareCallHierarchy", params)
            .await?;

        let items = result
            .get("result")
            .cloned()
            .unwrap_or(Value::Null);

        match items {
            Value::Array(arr) => Ok(arr),
            _ => Ok(vec![]),
        }
    }

    /// Send textDocument/didOpen so the LSP knows about the file.
    fn open_document(&self, file_path: &str, uri: &str) -> Result<(), TasukiError> {
        // Skip if already opened to avoid duplicate didOpen notifications
        {
            let mut opened = self.opened_files.lock();
            if opened.contains(uri) {
                return Ok(());
            }
            opened.insert(uri.to_string());
        }

        let root_uri = self.root_uri.lock().clone();
        let root_path = root_uri.strip_prefix("file://").unwrap_or(&root_uri);
        let full_path = if file_path.starts_with('/') {
            file_path.to_string()
        } else {
            format!("{root_path}/{file_path}")
        };

        let content = std::fs::read_to_string(&full_path).unwrap_or_default();
        let lang_id = detect_language_id(file_path);

        self.send_notification(
            "textDocument/didOpen",
            json!({
                "textDocument": {
                    "uri": uri,
                    "languageId": lang_id,
                    "version": 1,
                    "text": content
                }
            }),
        );

        Ok(())
    }
}

// ---- Free functions ----

fn detect_lsp_command(language_id: &str) -> Option<(&'static str, Vec<&'static str>)> {
    match language_id {
        "typescript" | "javascript" | "typescriptreact" | "javascriptreact" => {
            Some(("typescript-language-server", vec!["--stdio"]))
        }
        "rust" => Some(("rust-analyzer", vec![])),
        "python" => Some(("pyright-langserver", vec!["--stdio"])),
        "go" => Some(("gopls", vec!["serve"])),
        "php" => Some(("intelephense", vec!["--stdio"])),
        _ => None,
    }
}

fn detect_language_id(file_path: &str) -> &'static str {
    match file_path.rsplit('.').next() {
        Some("ts") => "typescript",
        Some("tsx") => "typescriptreact",
        Some("js") => "javascript",
        Some("jsx") => "javascriptreact",
        Some("rs") => "rust",
        Some("py") => "python",
        Some("go") => "go",
        Some("php") => "php",
        _ => "plaintext",
    }
}

/// Detect the primary language from changed file extensions.
pub fn detect_primary_language(file_paths: &[String]) -> Option<String> {
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for path in file_paths {
        let lang = detect_language_id(path);
        if lang != "plaintext" {
            *counts.entry(lang).or_insert(0) += 1;
        }
    }
    counts
        .into_iter()
        .max_by_key(|(_, c)| *c)
        .map(|(lang, _)| lang.to_string())
}

fn path_to_uri(file_path: &str, root_uri: &str) -> String {
    if file_path.starts_with('/') {
        format!("file://{file_path}")
    } else {
        let root = root_uri.strip_prefix("file://").unwrap_or(root_uri);
        format!("file://{root}/{file_path}")
    }
}

/// Read LSP JSON-RPC message from a buffered reader.
fn read_lsp_message(reader: &mut BufReader<impl std::io::Read>) -> Result<Option<Value>, TasukiError> {
    let mut content_length: usize = 0;

    // Read headers
    loop {
        let mut header_line = String::new();
        let n = reader
            .read_line(&mut header_line)
            .map_err(|e| TasukiError::Lsp(format!("Failed to read LSP header: {e}")))?;
        if n == 0 {
            return Ok(None); // EOF
        }
        let trimmed = header_line.trim();
        if trimmed.is_empty() {
            break; // End of headers
        }
        if let Some(len_str) = trimmed.strip_prefix("Content-Length: ") {
            content_length = len_str
                .parse()
                .map_err(|e| TasukiError::Lsp(format!("Invalid Content-Length: {e}")))?;
        }
    }

    if content_length == 0 {
        return Err(TasukiError::Lsp("Missing Content-Length header".to_string()));
    }

    // Read body
    let mut body = vec![0u8; content_length];
    std::io::Read::read_exact(reader, &mut body)
        .map_err(|e| TasukiError::Lsp(format!("Failed to read LSP body: {e}")))?;

    let msg: Value = serde_json::from_slice(&body)
        .map_err(|e| TasukiError::Lsp(format!("Invalid LSP JSON: {e}")))?;

    Ok(Some(msg))
}

/// Parse LSP DocumentSymbol response into our type.
fn parse_document_symbols(value: &Value, file_path: &str) -> Vec<DocumentSymbol> {
    match value {
        Value::Array(arr) => arr.iter().filter_map(|v| parse_one_symbol(v, file_path)).collect(),
        _ => vec![],
    }
}

fn parse_one_symbol(value: &Value, file_path: &str) -> Option<DocumentSymbol> {
    let name = value.get("name")?.as_str()?.to_string();
    let kind_num = value.get("kind")?.as_u64()?;
    let kind = symbol_kind_to_string(kind_num);

    let range = value.get("range")?;
    let start = range.get("start")?;
    let end = range.get("end")?;

    let children_val = value.get("children").cloned().unwrap_or(Value::Null);
    let children = parse_document_symbols(&children_val, file_path);

    Some(DocumentSymbol {
        name,
        kind,
        file_path: file_path.to_string(),
        start_line: start.get("line")?.as_u64()? as u32,
        start_character: start.get("character")?.as_u64()? as u32,
        end_line: end.get("line")?.as_u64()? as u32,
        end_character: end.get("character")?.as_u64()? as u32,
        children,
    })
}

fn symbol_kind_to_string(kind: u64) -> String {
    match kind {
        6 => "method".to_string(),
        12 => "function".to_string(),
        9 => "constructor".to_string(),
        5 => "class".to_string(),
        11 => "interface".to_string(),
        13 => "variable".to_string(),
        14 => "constant".to_string(),
        23 => "struct".to_string(),
        10 => "enum".to_string(),
        2 => "module".to_string(),
        _ => format!("kind_{kind}"),
    }
}

/// Flatten a tree of DocumentSymbols to only function-level symbols.
fn flatten_function_symbols(symbols: &[DocumentSymbol]) -> Vec<&DocumentSymbol> {
    let mut result = Vec::new();
    for sym in symbols {
        match sym.kind.as_str() {
            "function" | "method" | "constructor" => {
                result.push(sym);
            }
            _ => {
                // Recurse into children (e.g., methods inside classes)
                result.extend(flatten_function_symbols(&sym.children));
            }
        }
    }
    result
}

/// Parse incoming calls response.
fn parse_incoming_calls(value: &Value) -> Vec<CallHierarchyCall> {
    match value {
        Value::Array(arr) => arr
            .iter()
            .filter_map(|v| {
                let from = v.get("from")?;
                parse_call_hierarchy_item(from)
            })
            .collect(),
        _ => vec![],
    }
}

/// Parse outgoing calls response.
fn parse_outgoing_calls(value: &Value) -> Vec<CallHierarchyCall> {
    match value {
        Value::Array(arr) => arr
            .iter()
            .filter_map(|v| {
                let to = v.get("to")?;
                parse_call_hierarchy_item(to)
            })
            .collect(),
        _ => vec![],
    }
}

fn parse_call_hierarchy_item(item: &Value) -> Option<CallHierarchyCall> {
    let name = item.get("name")?.as_str()?.to_string();
    let kind_num = item.get("kind")?.as_u64()?;
    let kind = symbol_kind_to_string(kind_num);

    let uri = item.get("uri")?.as_str()?;
    let file_path = uri_to_path(uri);

    let range = item.get("range")?;
    let start = range.get("start")?;

    Some(CallHierarchyCall {
        name,
        kind,
        file_path,
        line: start.get("line")?.as_u64()? as u32,
        character: start.get("character")?.as_u64()? as u32,
        code_snippet: String::new(), // Will be filled by caller if needed
    })
}

fn uri_to_path(uri: &str) -> String {
    uri.strip_prefix("file://").unwrap_or(uri).to_string()
}

/// Read method code from a source file given line range.
fn read_method_code(root_path: &str, file_path: &str, start_line: u32, end_line: u32) -> String {
    use std::path::PathBuf;

    let root = PathBuf::from(root_path);
    let full_path = if file_path.starts_with('/') {
        PathBuf::from(file_path)
    } else {
        root.join(file_path)
    };

    // Verify the resolved path stays within the repo root
    let canonical = match full_path.canonicalize() {
        Ok(p) => p,
        Err(_) => return String::new(),
    };
    let canonical_root = match root.canonicalize() {
        Ok(p) => p,
        Err(_) => return String::new(),
    };
    if !canonical.starts_with(&canonical_root) {
        return String::new();
    }

    let content = match std::fs::read_to_string(&canonical) {
        Ok(c) => c,
        Err(_) => return String::new(),
    };

    let lines: Vec<&str> = content.lines().collect();
    let start = start_line as usize;
    let end = (end_line as usize + 1).min(lines.len());

    if start >= lines.len() {
        return String::new();
    }

    lines[start..end].join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_match_lines_to_symbols() {
        let symbols = vec![
            DocumentSymbol {
                name: "handleSubmit".to_string(),
                kind: "function".to_string(),
                file_path: "src/app.ts".to_string(),
                start_line: 10,
                start_character: 0,
                end_line: 20,
                end_character: 1,
                children: vec![],
            },
            DocumentSymbol {
                name: "validate".to_string(),
                kind: "function".to_string(),
                file_path: "src/app.ts".to_string(),
                start_line: 25,
                start_character: 0,
                end_line: 35,
                end_character: 1,
                children: vec![],
            },
        ];

        let changed = ChangedLines {
            added: vec![12, 14, 30],
            deleted: vec![],
        };

        let methods = LspState::match_lines_to_symbols("src/app.ts", &changed, &symbols);
        assert_eq!(methods.len(), 2);
        assert_eq!(methods[0].name, "handleSubmit");
        assert_eq!(methods[0].changed_lines, vec![12, 14]);
        assert_eq!(methods[1].name, "validate");
        assert_eq!(methods[1].changed_lines, vec![30]);
    }

    #[test]
    fn test_match_deduplicates_same_method() {
        let symbols = vec![DocumentSymbol {
            name: "foo".to_string(),
            kind: "function".to_string(),
            file_path: "test.ts".to_string(),
            start_line: 1,
            start_character: 0,
            end_line: 10,
            end_character: 1,
            children: vec![],
        }];

        let changed = ChangedLines {
            added: vec![3, 5, 7],
            deleted: vec![4],
        };

        let methods = LspState::match_lines_to_symbols("test.ts", &changed, &symbols);
        assert_eq!(methods.len(), 1);
        assert_eq!(methods[0].change_type, "modified");
        assert_eq!(methods[0].changed_lines.len(), 4);
    }

    #[test]
    fn test_detect_primary_language() {
        let files = vec![
            "src/app.ts".to_string(),
            "src/utils.ts".to_string(),
            "src/styles.css".to_string(),
            "README.md".to_string(),
        ];
        assert_eq!(detect_primary_language(&files), Some("typescript".to_string()));
    }

    #[test]
    fn test_flatten_function_symbols() {
        let symbols = vec![DocumentSymbol {
            name: "MyClass".to_string(),
            kind: "class".to_string(),
            file_path: "test.ts".to_string(),
            start_line: 0,
            start_character: 0,
            end_line: 50,
            end_character: 1,
            children: vec![
                DocumentSymbol {
                    name: "constructor".to_string(),
                    kind: "constructor".to_string(),
                    file_path: "test.ts".to_string(),
                    start_line: 2,
                    start_character: 0,
                    end_line: 5,
                    end_character: 1,
                    children: vec![],
                },
                DocumentSymbol {
                    name: "doWork".to_string(),
                    kind: "method".to_string(),
                    file_path: "test.ts".to_string(),
                    start_line: 7,
                    start_character: 0,
                    end_line: 15,
                    end_character: 1,
                    children: vec![],
                },
            ],
        }];

        let flat = flatten_function_symbols(&symbols);
        assert_eq!(flat.len(), 2);
        assert_eq!(flat[0].name, "constructor");
        assert_eq!(flat[1].name, "doWork");
    }
}
