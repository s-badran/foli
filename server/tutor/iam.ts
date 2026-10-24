import type { TutorLesson } from './aws';

function topic(
  key: string,
  title: string,
  start: number,
  end: number,
  rule: string,
  cards: [string, string][],
  scenario: string,
  options: TutorLesson['options'],
  explanation: string,
): TutorLesson {
  return {
    title,
    objectiveKey: key,
    pages: [start, end],
    rule,
    reasoning: explanation,
    trap: 'Separate authentication, authorization and credential handling. A convenient access mechanism must not replace least-privilege controls.',
    recall: cards[0][0],
    contrast: cards.at(-1)![0],
    scenario,
    options,
    explanation,
    check: '',
    cards: cards.map(([question, answer]) => ({ question, answer })),
  };
}

export const iamObjectives = [
  { key: 'users-groups', title: 'Users and groups', pageStart: 25, pageEnd: 25 },
  { key: 'permissions', title: 'Permissions and least privilege', pageStart: 26, pageEnd: 26 },
  {
    key: 'policies',
    title: 'Policy inheritance, structure and evaluation',
    pageStart: 27,
    pageEnd: 28,
  },
  { key: 'mfa', title: 'Password policy and MFA', pageStart: 29, pageEnd: 32 },
  { key: 'cli', title: 'AWS CLI and programmatic access', pageStart: 33, pageEnd: 35 },
  { key: 'sdk', title: 'AWS SDK and application credentials', pageStart: 36, pageEnd: 36 },
  { key: 'roles', title: 'IAM roles for services', pageStart: 37, pageEnd: 37 },
  {
    key: 'security-tools',
    title: 'Credential report and Access Advisor',
    pageStart: 38,
    pageEnd: 38,
  },
  { key: 'best-practices', title: 'IAM best practices', pageStart: 39, pageEnd: 40 },
];

export const iamLessons: TutorLesson[] = [
  topic(
    'users-groups',
    'Users and groups',
    25,
    25,
    'An IAM user is an identity; a group organizes permissions for users. Groups can contain users, not other groups, and one user may belong to several groups. IAM is global, while individual service resources may be regional.',
    [
      ['Can an IAM group contain another group?', 'No. IAM groups contain users only.'],
      ['Can an IAM user belong to several groups?', 'Yes.'],
      ['Is IAM a regional service?', 'No. IAM is a global service.'],
      [
        'Is the root identity intended for routine work?',
        'No. Protect it and reserve it for tasks that require root.',
      ],
    ],
    'A developer needs the permissions of both the engineering and audit teams. The administrator proposes nesting the audit group inside the engineering group. Which design matches IAM group behavior?',
    [
      'Place the developer in both groups and review the resulting effective permissions.',
      'Nest the audit group inside engineering so permissions inherit automatically.',
      'Create an IAM user in each Region because group membership is regional.',
      'Share the root login so the developer inherits every group permission.',
    ],
    'IAM groups cannot contain groups, but a user can belong to multiple groups. Group policies contribute permissions subject to applicable denies and other limits. Modern workforce federation is a labelled extension to the source, not a reason to omit these IAM fundamentals.',
  ),
  topic(
    'permissions',
    'Permissions and least privilege',
    26,
    26,
    'Policies describe permitted or denied actions on resources, potentially under conditions. Least privilege means granting only what the workload or person needs, rather than selecting an access mechanism and assuming it grants every action.',
    [
      ['What does least privilege mean?', 'Grant only the actions and resource access required.'],
      ['What document defines IAM permissions?', 'An IAM policy expressed as JSON.'],
      [
        'Does successful authentication authorize every AWS action?',
        'No. Applicable policies still determine authorization.',
      ],
    ],
    'A support team must list EC2 instances to diagnose incidents but must not launch or terminate them. Which permission approach best meets the requirement?',
    [
      'Allow the necessary describe/list actions and omit write permissions.',
      'Grant AdministratorAccess because access through the CLI is read-only.',
      'Allow all EC2 actions and rely on MFA to block accidental termination.',
      'Share a full-access user so incident responders do not need individual permissions.',
    ],
    'The required actions are observational, so permission scope should reflect that. MFA strengthens authentication but does not turn an allowed write into a read-only action. Console and CLI calls are both authorized through policies.',
  ),
  topic(
    'policies',
    'Policy structure and evaluation',
    27,
    28,
    'A policy contains statements with an Effect, Action and Resource, plus other fields as applicable. Conditions narrow when a statement applies. Permissions can come from user and group policies, but an applicable explicit deny wins over an allow. Principal belongs in policies that identify a resource-side or trust principal, not every identity policy.',
    [
      ['Which policy field chooses Allow or Deny?', 'Effect.'],
      ['Which field names permitted API operations?', 'Action.'],
      ['Which field scopes the affected resources?', 'Resource.'],
      ['What does a policy Condition restrict?', 'The circumstances in which a statement applies.'],
      ['What wins when an applicable Allow and explicit Deny conflict?', 'The explicit Deny.'],
      [
        'Is Principal required in an IAM identity-based policy?',
        'No. The attached identity is already the policy subject.',
      ],
    ],
    'A user has a group policy allowing s3:GetObject and a user policy explicitly denying s3:GetObject for the confidential prefix. The user requests an object in that prefix. What is the result?',
    [
      'Access is denied because the applicable explicit deny overrides the allow.',
      'Access is allowed because group policies always outrank user policies.',
      'Access is allowed if the allow statement appears earlier in the JSON document.',
      'Access is allowed when the user switches from the console to an SDK.',
    ],
    'Policy order and access client do not cancel an applicable explicit deny. Evaluate the requested action, resource and conditions across applicable policies. Other permission boundaries can further restrict an otherwise allowed request.',
  ),
  topic(
    'mfa',
    'Password policy and MFA',
    29,
    32,
    'A password policy controls requirements such as length, character composition and reuse for IAM-user passwords. MFA adds another authentication factor, such as a supported authenticator or security key. Neither mechanism grants additional permissions or automatically changes how every access key is used.',
    [
      ['What does MFA add to a password login?', 'An additional authentication factor.'],
      [
        'What can an IAM password policy control?',
        'Password requirements such as length and reuse.',
      ],
      [
        'Does enabling MFA grant more permissions?',
        'No. Authentication and authorization are separate.',
      ],
      [
        'Does a strong password protect a leaked access key?',
        'No. Compromised programmatic credentials need separate response.',
      ],
    ],
    'An organization requires stronger console sign-in protection for privileged users. It also has CLI scripts using access keys. Which statement is correct?',
    [
      'Enforce suitable passwords and MFA for sign-in, and separately secure or replace programmatic credentials.',
      'Once console MFA is enabled, every existing access key automatically requires an interactive MFA challenge.',
      'A password complexity policy rotates all CLI access keys automatically.',
      'MFA makes least-privilege permissions unnecessary for administrators.',
    ],
    'MFA and password controls protect their authentication flows. Existing access keys are not automatically transformed into interactive MFA sessions; policies and temporary-session workflows need explicit design. Credentials and authorization still require least privilege and monitoring.',
  ),
  topic(
    'cli',
    'AWS CLI and programmatic access',
    33,
    35,
    'The AWS CLI invokes AWS APIs from a command-line shell and supports automation. It uses an appropriate credential source, such as a temporary session or configured access keys, rather than an ordinary console password as the API signing secret. A profile selects configuration; it does not create permissions.',
    [
      ['What is the AWS CLI used for?', 'Calling AWS service APIs from a shell or script.'],
      [
        'Does choosing a CLI profile grant permissions?',
        'No. The selected identity still needs authorization.',
      ],
      [
        'Is a console password an API signing secret?',
        'No. Use supported programmatic credentials or sessions.',
      ],
      ['Should CLI access keys be shared?', 'No. Treat them as secrets tied to an identity.'],
    ],
    'An operator can sign in to the console but a CLI profile receives AccessDenied for an API call. They propose renaming the profile to administrator. What should be checked instead?',
    [
      'The identity and credentials selected by the profile and the policies authorizing the requested API action.',
      'Whether the profile name contains the word administrator, which grants API access.',
      'Whether the console password was copied into the secret access key field.',
      'Whether using the CLI exempts the request from IAM policy checks.',
    ],
    'The CLI is another client for AWS APIs, not a permission bypass. Profile selection and credential resolution determine the caller; policies determine allowed actions. Renaming local configuration does not alter IAM permissions.',
  ),
  topic(
    'sdk',
    'AWS SDK and application credentials',
    36,
    36,
    'An SDK is a language-specific library for invoking AWS APIs from application code. Use supported credential providers so the application can obtain appropriate temporary workload credentials. Do not embed permanent user secrets in source code merely because a library accepts credential parameters.',
    [
      ['What is an AWS SDK?', 'A language-specific library for calling AWS service APIs.'],
      [
        'What is the main CLI versus SDK distinction?',
        'The CLI is a shell tool; an SDK is used in application code.',
      ],
      [
        'Where should a workload SDK obtain credentials?',
        'From a suitable configured provider, preferably temporary workload credentials.',
      ],
    ],
    'A Node.js application on EC2 reads private S3 objects. Which credential approach avoids shipping permanent credentials with the application?',
    [
      'Let the SDK obtain the instance-role temporary credentials through its supported provider chain.',
      'Commit a user secret in the application repository because SDK libraries encrypt source code.',
      'Use the console password as the SDK secret access key.',
      'Assume using an official SDK automatically grants access to every bucket.',
    ],
    'An SDK handles API requests but still needs an authorized identity. An instance role supplies rotating temporary credentials without application-distributed long-lived keys. This secure credential-provider detail expands the source discussion; it does not replace the CLI/SDK distinction.',
  ),
  topic(
    'roles',
    'IAM roles for services',
    37,
    37,
    'A service role lets an AWS service or workload act under assigned permissions. The role trust relationship governs who can assume it; its permissions govern allowed operations. EC2 instance profiles and Lambda execution roles are examples of different attachment mechanisms for workload identity.',
    [
      [
        'What does a service role provide to a workload?',
        'Permissions through an assumable identity, typically using temporary credentials.',
      ],
      ['What does a role trust policy govern?', 'Who or what may assume the role.'],
      [
        'What does the role permissions policy govern?',
        'Which operations the assumed identity may perform.',
      ],
      ['How is an EC2 instance role exposed to the instance?', 'Through an instance profile.'],
    ],
    'A Lambda function must write objects to one S3 bucket. Which design gives it an appropriate service identity?',
    [
      'Attach an execution role trusted by Lambda with the required bucket-write permissions.',
      'Place an IAM user password in the function environment and use it as an API key.',
      'Add the function name to an IAM group because groups can contain AWS services.',
      'Make the bucket public so the function does not need a role.',
    ],
    'The execution role establishes workload identity and scoped authorization. A group is a collection of users, not a service identity. Making the bucket public or sharing a user secret is not required for service-to-service authorization.',
  ),
  topic(
    'security-tools',
    'IAM security tools',
    38,
    38,
    'The IAM credential report is an account-level view of IAM users and credential status. Access Advisor shows service last-accessed information for the selected identity. Use these as evidence when investigating unused or risky access, while checking real operational needs before removing permissions.',
    [
      ['Which tool reports IAM-user credential status account-wide?', 'The IAM credential report.'],
      [
        'Which tool shows service last-accessed information for an identity?',
        'IAM Access Advisor.',
      ],
      [
        'Does no recent use prove a permission is never needed?',
        'No. Check infrequent jobs and operational requirements.',
      ],
    ],
    'A security review needs both an account-wide list of IAM-user credential status and evidence about services an individual identity has accessed. Which pairing fits?',
    [
      'Use the credential report for user credential status and Access Advisor for service last-accessed evidence.',
      'Use Access Advisor as the only account-wide password and access-key inventory.',
      'Use a password policy as the historical record of all API activity.',
      'Use the credential report to grant service permissions automatically.',
    ],
    'These tools answer different questions: credential status versus last service access. Neither grants permissions. Last-accessed information can guide least-privilege reviews but must not blindly remove permissions needed by seasonal or emergency operations.',
  ),
  topic(
    'best-practices',
    'IAM best practices',
    39,
    40,
    'Keep human identities attributable, avoid sharing credentials, protect root access, enforce suitable authentication controls and review permissions. Use service roles for workloads instead of distributing human access keys. For modern workforce access, federation can reduce long-lived IAM-user credentials; that is a labelled extension to the source examples.',
    [
      [
        'Why should people avoid sharing an IAM identity?',
        'Shared identities weaken individual accountability and revocation.',
      ],
      [
        'What is preferable to human access keys on an AWS workload?',
        'A scoped service or workload role.',
      ],
      [
        'What should happen when a secret access key is exposed?',
        'Revoke or disable it promptly and investigate misuse.',
      ],
      [
        'When should root credentials be used?',
        'Only for tasks that require root, not routine administration.',
      ],
    ],
    'A team proposes one shared privileged access key for staff scripts and EC2 applications, with a strong console password. What is the best response?',
    [
      'Use attributable human access and scoped workload roles; remove the shared long-lived credential.',
      'Approve it because console password strength protects every programmatic key.',
      'Keep the shared key and rename the account to improve attribution.',
      'Store the shared key in a public configuration file so rotation is easier.',
    ],
    'A shared privileged key collapses accountability and grants unnecessary shared access. Console password controls do not secure a leaked API key. Separate human access from workload identity and review each permission scope.',
  ),
];
