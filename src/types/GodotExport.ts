export interface ExportPresets {
  preset: { [key: string]: ExportPreset };
}

export interface ExportPreset {
  name: string;
  export_path: string;
  platform: string;
}

export type BuildResult = {
  directory: string;
  sanitizedName: string;
  executablePath: string;
  directoryEntryCount: number;
  preset: ExportPreset;
  archivePath?: string;
};
