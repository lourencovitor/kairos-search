export const downloadableFiles = [
  'report.csv',
  'report-junior.csv',
  'report-pleno.csv',
  'report-senior.csv',
  'report-staff.csv',
  'report-arq.csv',
  'report-qa.csv',
  'report-devops.csv',
  'report-management.csv',
  'report.md',
  'summary.json',
  'filter-funnel.json',
] as const;

export type DownloadableFile = (typeof downloadableFiles)[number];

export function isDownloadableFile(filename: string): filename is DownloadableFile {
  return downloadableFiles.includes(filename as DownloadableFile);
}

export function labelDownload(filename: string): string {
  return filename
    .replace('report-', '')
    .replace('.csv', '')
    .replace('.md', '')
    .replace('.json', '')
    .replace('report', 'all jobs')
    .replace('summary', 'summary')
    .replace('filter-funnel', 'filter funnel');
}
