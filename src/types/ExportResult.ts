import { ExportPreset } from './ExportPresets';

export default interface ExportResult {
  sanitizedName: string;
  buildDirectory: string;
  preset: ExportPreset;
}
