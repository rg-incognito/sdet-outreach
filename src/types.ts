export interface JobPosting {
  id: string;
  source: "linkedin";
  url: string;
  title: string;
  company: string;
  location?: string;
  descriptionText: string;
  scrapedAt: string;
}

export interface JobScraper {
  name: "linkedin";
  scrape(cfg: Config): Promise<JobPosting[]>;
}

export interface Config {
  gemini: {
    apiKey: string;
  };
  gmail: {
    user: string;
    appPassword: string;
  };
  search: {
    // Full LinkedIn content-search boolean query strings, run as-is (one search per
    // entry, results merged) - see linkedin.ts. This *is* the filter stage; there's no
    // separate title-match/reject-regex pass like JobMailer's combined flow.
    queries: string[];
    maxJobsPerRun: number;
    // LinkedIn geoUrn ID for the content-search region facet (e.g. "103644278" = United
    // States). Empty string means no region facet is applied to the search URL.
    regionGeoUrn: string;
  };
  sources: {
    linkedin: { storageStatePath: string };
  };
  masterResumePath: string;
  candidateName: string;
  candidatePhone: string;
}

export interface FilterCounts {
  scraped: number;
  notIndia: number;
  hasEmail: number;
  sent: number;
}

export interface FilteredJob {
  job: JobPosting;
  recruiterEmail: string;
}

export interface TailoredResume {
  markdown: string;
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
}
