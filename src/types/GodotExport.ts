export interface ExportPresets {
  preset: { [key: string]: ExportPreset };
}

export interface ExportPreset {
  name: string;
  export_path: string;
  platform: string;
}

export interface ExportResult {
  sanitizedName: string;
  buildDirectory: string;
  preset: ExportPreset;
}
