export interface ExportPresets {
  preset: { [key: string]: ExportPreset };
}

export interface ExportPreset {
  name: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  export_path: string;
  platform: 'Windows Desktop' | 'Linux/X11' | 'macOS' | 'Web' | 'Android' | 'iOS' | 'UWP';
}

export type BuildResult = {
  directory: string;
  sanitizedName: string;
  executablePath: string;
  directoryEntryCount: number;
  preset: ExportPreset;
  archivePath?: string;
};
