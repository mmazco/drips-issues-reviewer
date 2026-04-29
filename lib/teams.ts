export interface WaveTeam {
  name: string;
  // Primary repo URL — for teams with multiple repos (ACTA, Ding) the
  // additional repos are mentioned in `notes`.
  repoUrl: string;
  openIssues: number | null;
  // Letter grade if scored; null if just "Reviewed" without a number,
  // or not yet reviewed.
  issueGrade: string | null;
  hasCode: boolean | null;
  status: string;
  notes: string;
}

// Wave 4 — 22-29 April 2026. Source of truth: Stellar Wave 4 Hackathon
// Teams sheet. Only includes the 14 teams that applied to and were
// approved for Wave 4 in Warren's system.
export const WAVE4_TEAMS: WaveTeam[] = [
  {
    name: 'MañanaSeguro',
    repoUrl: 'https://github.com/davz7/MananaSeguro',
    openIssues: 12,
    issueGrade: 'A',
    hasCode: true,
    status: 'Reviewed · maintainer addressed feedback',
    notes: 'A (90%). Split issues #10 & #11 (too big). Add file paths to #5 & #7. Add test runner details to #4 & #6. Maintainer has updated issues based on feedback.',
  },
  {
    name: 'Seyf',
    repoUrl: 'https://github.com/Seyfert-Labs/seyf-app-main',
    openIssues: 22,
    issueGrade: 'A',
    hasCode: true,
    status: 'Reviewed',
    notes: 'A (estimated 85–90%). Likely needs file paths + acceptance criteria. Messaged on TG 17 Apr.',
  },
  {
    name: 'ACTA',
    repoUrl: 'https://github.com/ACTA-Team/zk-test',
    openIssues: 0,
    issueGrade: null,
    hasCode: true,
    status: 'Team to add issues',
    notes: 'Two repos: zk-test and demo-acta. No issues on either. Messaged on TG 16 Apr.',
  },
  {
    name: 'TANKO',
    repoUrl: 'https://github.com/Tanko-d/Tanko-d',
    openIssues: 1,
    issueGrade: null,
    hasCode: true,
    status: 'Reviewed',
    notes: 'Only 1 issue — scope concern. Messaged on TG 16 Apr.',
  },
  {
    name: 'Mercato',
    repoUrl: 'https://github.com/mercato-supply-chain/mercato-dapp',
    openIssues: 15,
    issueGrade: null,
    hasCode: true,
    status: 'Review pending',
    notes: '',
  },
  {
    name: 'Proyecto Manná',
    repoUrl: 'https://github.com/kuisser116/Manna',
    openIssues: 3,
    issueGrade: null,
    hasCode: true,
    status: 'Review pending',
    notes: 'Only 3 issues. Likely needs more issues + Drips rubric fixes. No English docs.',
  },
  {
    name: 'Bimex',
    repoUrl: 'https://github.com/David1984TK/Bimex',
    openIssues: 20,
    issueGrade: null,
    hasCode: true,
    status: 'Review pending',
    notes: 'Likely needs template, file paths, setup, acceptance criteria. Remove non-code issues #10 & #18. Split #11–13. Add wave label. Messaged on TG 16 Apr.',
  },
  {
    name: 'MicoPay',
    repoUrl: 'https://github.com/ericmt-98/micopay-protocol',
    openIssues: 31,
    issueGrade: 'A',
    hasCode: true,
    status: 'Reviewed',
    notes: 'A (estimated 85–90%). Create issues from README decomposition (8–12 issues). Messaged on TG 16 Apr.',
  },
  {
    name: 'Vyn',
    repoUrl: 'https://github.com/Kalebtron1/Project-Vyn',
    openIssues: 11,
    issueGrade: null,
    hasCode: null,
    status: 'Review pending · confirm code exists',
    notes: 'Confirm repo has code. Create issues if missing.',
  },
  {
    name: 'Nuup',
    repoUrl: 'https://github.com/Ander-tsx/NUUP',
    openIssues: null,
    issueGrade: null,
    hasCode: true,
    status: 'Review pending',
    notes: '',
  },
  {
    name: 'Tonalli',
    repoUrl: 'https://github.com/EmmaSA1/Hack-tonalli',
    openIssues: 28,
    issueGrade: null,
    hasCode: true,
    status: 'Review pending',
    notes: '',
  },
  {
    name: 'Ding Payments',
    repoUrl: 'https://github.com/Ding-Payments/ding-payments',
    openIssues: 0,
    issueGrade: 'F',
    hasCode: true,
    status: 'Team to add issues',
    notes: 'Two repos: ding-payments and ding-server. No issues on either.',
  },
  {
    name: 'BuenDia / DefiWise',
    repoUrl: 'https://github.com/BuenDia-Builders/defiwise-stellar',
    openIssues: 0,
    issueGrade: 'F',
    hasCode: true,
    status: 'Team to add issues',
    notes: 'Create issues. Maz to coach on issue quality.',
  },
  {
    name: 'PayStream',
    repoUrl: 'https://github.com/Vera3289/paystream-contracts',
    openIssues: 0,
    issueGrade: null,
    hasCode: true,
    status: 'Team to add issues',
    notes: 'Code confirmed in deep review. Create issues.',
  },
];
