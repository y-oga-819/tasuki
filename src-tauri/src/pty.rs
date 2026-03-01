use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use std::thread::JoinHandle;
use tauri::{AppHandle, Emitter};

use crate::error::TasukiError;

/// State for a single PTY terminal session.
pub struct PtyState {
    writer: Mutex<Option<Box<dyn Write + Send>>>,
    master: Mutex<Option<Box<dyn portable_pty::MasterPty + Send>>>,
    child: Mutex<Option<Box<dyn portable_pty::Child + Send + Sync>>>,
    reader_handle: Mutex<Option<JoinHandle<()>>>,
    alive: Mutex<bool>,
}

impl PtyState {
    pub fn new() -> Self {
        Self {
            writer: Mutex::new(None),
            master: Mutex::new(None),
            child: Mutex::new(None),
            reader_handle: Mutex::new(None),
            alive: Mutex::new(false),
        }
    }

    /// Whether a PTY session is currently active.
    pub fn is_alive(&self) -> bool {
        *self.alive.lock()
    }

    /// Spawn a new PTY session with the user's shell.
    pub fn spawn(&self, app: &AppHandle, cols: u16, rows: u16, cwd: &str) -> Result<(), TasukiError> {
        // Kill existing session if any
        self.kill();

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| TasukiError::Pty(format!("Failed to open PTY: {e}")))?;

        // Use the user's login shell, falling back to /bin/sh
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
        let mut cmd = CommandBuilder::new(&shell);
        cmd.args(["--login"]);
        cmd.cwd(cwd);

        // Inherit common environment variables
        for key in &["PATH", "HOME", "USER", "LANG", "TERM", "COLORTERM"] {
            if let Ok(val) = std::env::var(key) {
                cmd.env(key, val);
            }
        }
        // Ensure TERM is set for proper escape-sequence support
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| TasukiError::Pty(format!("Failed to spawn shell: {e}")))?;
        drop(pair.slave);

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| TasukiError::Pty(format!("Failed to clone PTY reader: {e}")))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|e| TasukiError::Pty(format!("Failed to take PTY writer: {e}")))?;

        *self.writer.lock() = Some(writer);
        *self.master.lock() = Some(pair.master);
        *self.child.lock() = Some(child);
        *self.alive.lock() = true;

        // Background thread: read PTY output and emit to frontend
        let app_handle = app.clone();
        let handle = std::thread::spawn(move || {
            let mut reader = reader;
            let mut buf = [0u8; 65536];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        let _ = app_handle.emit("pty-exit", ());
                        break;
                    }
                    Ok(n) => {
                        // Terminal output is essentially UTF-8 text + escape sequences.
                        // from_utf8_lossy handles the rare non-UTF8 byte gracefully.
                        let text = String::from_utf8_lossy(&buf[..n]).into_owned();
                        let _ = app_handle.emit("pty-data", text);
                    }
                    Err(_) => {
                        let _ = app_handle.emit("pty-exit", ());
                        break;
                    }
                }
            }
        });

        *self.reader_handle.lock() = Some(handle);

        Ok(())
    }

    /// Write input data to the PTY.
    pub fn write(&self, data: &str) -> Result<(), TasukiError> {
        let mut guard = self.writer.lock();
        if let Some(writer) = guard.as_mut() {
            writer
                .write_all(data.as_bytes())
                .map_err(|e| TasukiError::Pty(format!("PTY write failed: {e}")))?;
            writer
                .flush()
                .map_err(|e| TasukiError::Pty(format!("PTY flush failed: {e}")))?;
            Ok(())
        } else {
            Err(TasukiError::Pty("No active PTY session".to_string()))
        }
    }

    /// Resize the PTY.
    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), TasukiError> {
        let guard = self.master.lock();
        if let Some(master) = guard.as_ref() {
            master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| TasukiError::Pty(format!("PTY resize failed: {e}")))?;
            Ok(())
        } else {
            Err(TasukiError::Pty("No active PTY session".to_string()))
        }
    }

    /// Kill the PTY session, cleaning up all resources.
    pub fn kill(&self) {
        // Drop the writer and master, which closes the PTY
        *self.writer.lock() = None;
        *self.master.lock() = None;

        // Kill and wait for the child process to avoid zombies
        if let Some(mut child) = self.child.lock().take() {
            let _ = child.kill();
            let _ = child.wait();
        }

        // Join the reader thread
        if let Some(handle) = self.reader_handle.lock().take() {
            let _ = handle.join();
        }

        *self.alive.lock() = false;
    }
}
