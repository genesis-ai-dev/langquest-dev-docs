export interface AmlError {
  message: string;
  line: number;
  column: number;
  severity: "error" | "warning";
}

export interface CodecWarning {
  message: string;
  raw: string;
}
