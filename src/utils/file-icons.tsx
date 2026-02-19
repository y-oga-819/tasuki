import React from "react";

const iconProps = { width: 16, height: 16, viewBox: "0 0 16 16" };

const TypeScriptIcon = () => (
  <svg {...iconProps} fill="#3178c6">
    <rect width="16" height="16" rx="2" />
    <text x="3" y="12" fontSize="9" fontWeight="bold" fill="#fff">TS</text>
  </svg>
);

const JavaScriptIcon = () => (
  <svg {...iconProps} fill="#f7df1e">
    <rect width="16" height="16" rx="2" />
    <text x="3.5" y="12" fontSize="9" fontWeight="bold" fill="#000">JS</text>
  </svg>
);

const CssIcon = () => (
  <svg {...iconProps} fill="#1572b6">
    <rect width="16" height="16" rx="2" />
    <text x="0.5" y="12" fontSize="8" fontWeight="bold" fill="#fff">CSS</text>
  </svg>
);

const JsonIcon = () => (
  <svg {...iconProps} fill="#292929">
    <rect width="16" height="16" rx="2" />
    <text x="1" y="12" fontSize="7" fontWeight="bold" fill="#f7df1e">{ }</text>
  </svg>
);

const MarkdownIcon = () => (
  <svg {...iconProps} fill="currentColor" opacity={0.7}>
    <path d="M2 3h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1.5 7V6L5 8.5 6.5 6v4h1.5V6h-1L5 9 3.5 6v4zm7-4v2.5H9L11 11l2-2.5h-1.5V6z" />
  </svg>
);

const RustIcon = () => (
  <svg {...iconProps} fill="#dea584">
    <rect width="16" height="16" rx="2" />
    <text x="2.5" y="12" fontSize="9" fontWeight="bold" fill="#000">Rs</text>
  </svg>
);

const ConfigIcon = () => (
  <svg {...iconProps} fill="currentColor" opacity={0.5}>
    <path d="M8 1.5a1 1 0 0 1 .894.553l.707 1.414 1.557.227a1 1 0 0 1 .554 1.706l-1.126 1.098.266 1.549a1 1 0 0 1-1.451 1.054L8 8.347l-1.401.754a1 1 0 0 1-1.451-1.054l.266-1.549L4.288 5.4a1 1 0 0 1 .554-1.706l1.557-.227.707-1.414A1 1 0 0 1 8 1.5zM8 10.5a5.5 5.5 0 0 0-4.9 3h9.8a5.5 5.5 0 0 0-4.9-3z" />
  </svg>
);

const DefaultFileIcon = () => (
  <svg {...iconProps} fill="currentColor" opacity={0.5}>
    <path d="M3.75 1.5A1.25 1.25 0 0 0 2.5 2.75v10.5c0 .69.56 1.25 1.25 1.25h8.5c.69 0 1.25-.56 1.25-1.25V5.5L9.5 1.5zM10 2l3.5 3.5H10z" />
  </svg>
);

export const FolderOpenIcon = () => (
  <svg {...iconProps} fill="currentColor" opacity={0.6}>
    <path d="M1.75 2.5A1.25 1.25 0 0 0 .5 3.75v8.5c0 .69.56 1.25 1.25 1.25h11.5l1.25-5H4.75l-1.25 5V4.5h3l1 1h5V3.75c0-.69-.56-1.25-1.25-1.25z" />
  </svg>
);

export const FolderClosedIcon = () => (
  <svg {...iconProps} fill="currentColor" opacity={0.6}>
    <path d="M1.75 2.5A1.25 1.25 0 0 0 .5 3.75v8.5c0 .69.56 1.25 1.25 1.25h12.5c.69 0 1.25-.56 1.25-1.25V5.25c0-.69-.56-1.25-1.25-1.25H7.5l-1-1.5z" />
  </svg>
);

const EXTENSION_MAP: Record<string, React.FC> = {
  ts: TypeScriptIcon,
  tsx: TypeScriptIcon,
  js: JavaScriptIcon,
  jsx: JavaScriptIcon,
  mjs: JavaScriptIcon,
  css: CssIcon,
  scss: CssIcon,
  json: JsonIcon,
  md: MarkdownIcon,
  mdx: MarkdownIcon,
  rs: RustIcon,
  toml: ConfigIcon,
  yaml: ConfigIcon,
  yml: ConfigIcon,
  lock: ConfigIcon,
};

// eslint-disable-next-line react-refresh/only-export-components
export function getFileIcon(filename: string): React.ReactElement {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const Icon = EXTENSION_MAP[ext] ?? DefaultFileIcon;
  return <Icon />;
}
