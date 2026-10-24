type Pair = readonly [string, string];
export const atomicCards: Record<string, Pair[]> = {
  'Workload identity and temporary credentials': [
    [
      'What gives an EC2 app temporary AWS credentials?',
      'An IAM role attached through an instance profile.',
    ],
    [
      'Where should EC2 application permissions be scoped?',
      'In its role policy, to the required actions and resources.',
    ],
  ],
  'Least privilege and cross-account access': [
    ['Does an explicit Deny override an Allow?', 'Yes, when that deny applies to the request.'],
    [
      'What authorizes cross-account AssumeRole?',
      'Caller permission plus a target-role trust policy accepting the caller.',
    ],
  ],
  'Compute pricing under interruption constraints': [
    ['Which workloads fit Spot instances?', 'Interruptible jobs that can checkpoint or retry.'],
    ['Which pricing option fits short, inflexible demand?', 'On-Demand capacity.'],
  ],
  'Bootstrap and replacement rather than repair': [
    [
      'Where should a replaceable web server keep sessions?',
      'In an external shared session store.',
    ],
    [
      'What makes an instance reproducible?',
      'A versioned image or repeatable bootstrap configuration.',
    ],
  ],
  'Placement groups and failure domains': [
    ['Which placement group prioritizes low inter-node latency?', 'A cluster placement group.'],
    [
      'Does cluster placement provide multi-AZ resilience?',
      'No. A cluster placement group is within one AZ.',
    ],
  ],
  'Administration without public SSH exposure': [
    [
      'Which service supports administration without inbound SSH?',
      'Systems Manager Session Manager.',
    ],
    [
      'What network path does Session Manager still need?',
      'Connectivity to its required service endpoints, through endpoints or controlled egress.',
    ],
  ],
  'Choosing block, shared file or ephemeral storage': [
    ['Which service provides shared Linux NFS storage?', 'Amazon EFS.'],
    ['Is instance store suitable as the sole durable copy?', 'No. It is ephemeral local storage.'],
  ],
  'Recovery through snapshots': [
    ['Can an EBS volume attach across AZs?', 'No. Volume and instance must be in the same AZ.'],
    ['How do you restore EBS data in another AZ?', 'Create a new volume there from a snapshot.'],
  ],
  'Load balancer selection': [
    ['Which load balancer routes by HTTP path?', 'Application Load Balancer (ALB).'],
    ['Which load balancer fits TCP/UDP transport routing?', 'Network Load Balancer (NLB).'],
  ],
  'Scaling without losing availability': [
    ['What does horizontal scaling add?', 'More instances or nodes.'],
    [
      'Does adding instances in one AZ remove AZ failure risk?',
      'No. Functional capacity must span failure domains.',
    ],
  ],
  'Database failover versus read scaling': [
    [
      'What is traditional RDS Multi-AZ primarily for?',
      'Availability through managed failover to a standby.',
    ],
    ['What is a read replica primarily for?', 'Offloading reads; replication can lag.'],
  ],
  'Caching and stale data': [
    [
      'What does a cache-aside miss do?',
      'Read from the authoritative store, then populate the cache.',
    ],
    ['What risk do cache expiration and invalidation control?', 'Serving stale values.'],
  ],
  'DNS failover and client caching': [
    [
      'Why can clients use an old DNS answer after failover?',
      'Their resolver or client may still cache it.',
    ],
    [
      'Does changing a TTL invalidate already cached answers?',
      'No. Existing cached answers can retain their original TTL.',
    ],
  ],
  'Routing policy and requirement matching': [
    ['Which Route 53 policy supports a canary traffic split?', 'Weighted routing.'],
    ['Can DNS route requests by URL path?', 'No. Use an application-layer router.'],
  ],
  'Making a web tier truly stateless': [
    [
      'What allows any healthy web instance to handle a session?',
      'Session state stored outside the individual instance.',
    ],
    [
      'Do sticky sessions preserve state after instance failure?',
      'No. They only influence request routing.',
    ],
  ],
  'Decoupling slow work from request handling': [
    [
      'How can a web API hand off a slow background job?',
      'Persist a job to a durable queue for independent workers.',
    ],
    [
      'Why should queue workers be idempotent?',
      'Retries or duplicate deliveries must not duplicate business effects.',
    ],
  ],
  'Object storage versus filesystem semantics': [
    ['What storage abstraction does S3 expose?', 'Objects accessed by key through APIs.'],
    [
      'Does S3 offer native POSIX filesystem semantics?',
      'No. Use an appropriate file service when those semantics are required.',
    ],
  ],
  'Private object delivery': [
    ['What delegates time-limited access to one S3 operation?', 'A presigned request.'],
    ['Why must a presigned URL be protected?', 'It is a bearer capability while valid.'],
  ],
  'Storage class and retrieval constraints': [
    [
      'Which latency constraint matters before archiving data?',
      'The required retrieval or restore time.',
    ],
    [
      'Can the cheapest storage price produce a higher total bill?',
      'Yes, after retrieval charges and minimum-duration costs.',
    ],
  ],
  'Versioning and replication are different safeguards': [
    [
      'What protects S3 object history after an overwrite?',
      'Versioning, subject to version deletion and retention controls.',
    ],
    [
      'Is replication automatically an immutable backup?',
      'No. Write, deletion and retention behavior must be configured.',
    ],
  ],
  'Authorization and encryption permissions': [
    [
      'What extra permission may an SSE-KMS S3 read require?',
      'Permission to decrypt with the relevant KMS key.',
    ],
    [
      'Does encryption at rest make a bucket private?',
      'No. Authorization and public-access controls are separate.',
    ],
  ],
  'Private origins and least exposure': [
    [
      'What authorizes CloudFront access to a private S3 REST origin?',
      'Origin Access Control with a scoped bucket policy.',
    ],
    [
      'Does origin authorization also authorize every viewer?',
      'No. Viewer authorization is a separate control.',
    ],
  ],
  'Caching content versus accelerating transport': [
    ['Which global service supports TCP/UDP ingress with anycast IPs?', 'AWS Global Accelerator.'],
    ['Which service provides HTTP edge caching?', 'Amazon CloudFront.'],
  ],
  'Cache keys and authorization correctness': [
    ['What must a cache key include?', 'Inputs that change the safely reusable response.'],
    [
      'What happens if a response-varying parameter is omitted?',
      'Different variants can share an incorrect cached response.',
    ],
  ],
  'Hybrid access and bulk transfer': [
    [
      'What physical limit can acceleration not eliminate?',
      'The available last-mile network bandwidth.',
    ],
    [
      'When should offline bulk transfer be evaluated?',
      'When network transfer cannot meet the migration window.',
    ],
  ],
  'Windows and Linux file workloads': [
    ['Which managed file service targets SMB and AD integration?', 'FSx for Windows File Server.'],
    ['Which protocol does EFS primarily expose?', 'NFS.'],
  ],
  'Queues, visibility and idempotency': [
    ['What delivery model does standard SQS use?', 'At-least-once delivery.'],
    [
      'Does a visibility timeout acknowledge processing success?',
      'No. Delete the message after successful processing.',
    ],
  ],
  'Fan-out versus replayable streams': [
    [
      'How can every subscriber get an independent durable backlog?',
      'SNS fan-out to a separate SQS queue per subscriber.',
    ],
    [
      'What does one queue shared by competing consumers do?',
      'Distributes work; it does not broadcast every event to each consumer.',
    ],
  ],
  'Choosing container orchestration and capacity': [
    [
      'What does Fargate remove from container operations?',
      'Management of underlying worker compute infrastructure.',
    ],
    ['Does ECR execute and scale container tasks?', 'No. ECR stores container images.'],
  ],
  'Task identity and scoped permissions': [
    ['Which ECS role authorizes application AWS API calls?', 'The task role.'],
    [
      'What is the ECS task execution role for?',
      'Startup support such as image pulls and configured log delivery.',
    ],
  ],
  'Lambda scaling and downstream protection': [
    [
      'Why can more Lambda concurrency overload a database?',
      'More simultaneous invocations can exhaust connections or capacity.',
    ],
    [
      'Which service can pool RDS connections for Lambda workloads?',
      'RDS Proxy, subject to workload and session constraints.',
    ],
  ],
  'DynamoDB access patterns and partition design': [
    [
      'What should drive a DynamoDB key design?',
      'Required query access patterns and load distribution.',
    ],
    [
      'Does more table capacity always fix one hot key?',
      'No. Traffic may remain concentrated on its partition.',
    ],
  ],
  'Reliable event processing': [
    [
      'Why should an S3-triggered handler tolerate duplicates?',
      'Notifications can be delivered more than once.',
    ],
    [
      'What protects a business action from duplicate execution?',
      'A durable idempotency check using a suitable operation key.',
    ],
  ],
  'Static frontend and secure API boundaries': [
    [
      'Can a public JavaScript bundle keep a service secret?',
      'No. Clients can inspect its contents.',
    ],
    [
      'Does CORS replace API authentication?',
      'No. It is a browser policy, not server authorization.',
    ],
  ],
  'Match the data model to the query': [
    [
      'Which database model naturally fits joins and relational constraints?',
      'A relational database.',
    ],
    [
      'What should determine database selection before product popularity?',
      'Queries, consistency, transactions and operational requirements.',
    ],
  ],
  'Specialized databases and analytical boundaries': [
    ['Which database category fits multi-hop relationship traversal?', 'A graph database.'],
    ['Which managed AWS service supports graph workloads?', 'Amazon Neptune.'],
  ],
  'Querying a data lake without a warehouse cluster': [
    ['Which service queries supported S3 data with serverless SQL?', 'Amazon Athena.'],
    ['What reduces Athena bytes scanned?', 'Partition pruning and suitable columnar formats.'],
  ],
  'Stream ingestion versus processing': [
    ['Which service manages buffered delivery into S3?', 'Amazon Data Firehose.'],
    [
      'Which Kinesis service supports custom consumers and retained replay?',
      'Kinesis Data Streams.',
    ],
  ],
  'Prebuilt capability versus custom training': [
    ['Which managed service extracts text from scanned documents?', 'Amazon Textract.'],
    [
      'Does a prebuilt model remove the need to evaluate accuracy?',
      'No. Test representative inputs and governance requirements.',
    ],
  ],
  'Language, speech and operational fit': [
    ['Which service converts speech to text?', 'Amazon Transcribe.'],
    ['Which service converts text to speech?', 'Amazon Polly.'],
  ],
  'Operational telemetry versus API audit': [
    ['Which service helps identify who changed a security group?', 'AWS CloudTrail.'],
    ['Which service provides operational metrics, logs and alarms?', 'Amazon CloudWatch.'],
  ],
  'Actionable health and compliance signals': [
    ['Which service evaluates supported resource configuration rules?', 'AWS Config.'],
    [
      'Does configuration compliance prove runtime availability?',
      'No. Runtime health requires operational evidence.',
    ],
  ],
  'Federation rather than account-local user sprawl': [
    [
      'What reduces separate workforce identities across AWS accounts?',
      'Federation or IAM Identity Center with scoped assignments.',
    ],
    [
      'Does single sign-on imply administrator access for everyone?',
      'No. Permission assignments must remain least-privilege.',
    ],
  ],
  'Organization guardrails versus permission grants': [
    [
      'Do service control policies grant IAM permissions?',
      'No. They constrain the permissions available to affected principals.',
    ],
    ['Can an IAM Allow bypass an applicable SCP Deny?', 'No.'],
  ],
  'Key management and secret lifecycle': [
    [
      'Which service manages stored secrets and supported rotation workflows?',
      'AWS Secrets Manager.',
    ],
    [
      'Does a KMS key ID act as a rotating database password?',
      'No. KMS keys and database credentials serve different purposes.',
    ],
  ],
  'Application filtering and DDoS protection': [
    ['Which control filters supported HTTP requests at application level?', 'AWS WAF.'],
    [
      'Can a security group filter SQL injection strings?',
      'No. It controls network connections, not SQL payload content.',
    ],
  ],
  'Private egress and service endpoints': [
    [
      'What provides a private S3 route without NAT processing?',
      'An S3 gateway endpoint for supported traffic.',
    ],
    [
      'Does a security group create missing routes?',
      'No. Routing and traffic filtering are separate.',
    ],
  ],
  'Security groups, NACLs and return traffic': [
    [
      'Are security groups stateful?',
      'Yes. Return traffic for tracked allowed connections is permitted.',
    ],
    [
      'Why must NACL rules allow required return ports?',
      'NACLs are stateless and evaluate both traffic directions separately.',
    ],
  ],
  'Recovery objectives and strategy cost': [
    ['What does RPO bound?', 'Acceptable data loss measured in time.'],
    ['What does RTO bound?', 'Acceptable recovery time or downtime.'],
  ],
  'Migration with change capture': [
    [
      'What keeps a migration target current during ongoing writes?',
      'Supported change data capture after the initial load.',
    ],
    [
      'Does DMS guarantee application and schema compatibility?',
      'No. Compatibility and conversion need separate assessment.',
    ],
  ],
  'Find the real bottleneck': [
    [
      'Will adding web servers fix a saturated database query?',
      'Not by itself; investigate the constrained database path.',
    ],
    [
      'Why can scaling producers worsen an outage?',
      'They can overload a fixed-capacity downstream dependency.',
    ],
  ],
  'Resilience through bounded retries': [
    ['What reduces synchronized retry bursts?', 'Bounded exponential backoff with jitter.'],
    [
      'Does a timeout prove the remote side effect did not happen?',
      'No. Retried side effects still need idempotency.',
    ],
  ],
  'Orchestration versus message transport': [
    ['Which service coordinates explicit multi-step workflow states?', 'AWS Step Functions.'],
    [
      'Does orchestration make external side effects atomic?',
      'No. Safe retries and compensation still need design.',
    ],
  ],
  'Batch jobs and managed scheduling': [
    ['Which service schedules finite jobs on configured compute environments?', 'AWS Batch.'],
    [
      'How do finite batch jobs differ from web-service tasks?',
      'Jobs finish; service schedulers maintain ongoing serving capacity.',
    ],
  ],
  'Trade-offs across architecture pillars': [
    [
      'What makes an architecture answer appropriate?',
      'It satisfies the stated constraints with justified trade-offs.',
    ],
    ['Should an unstated optimization override an explicit requirement?', 'No.'],
  ],
  'Shared responsibility and evidence-based readiness': [
    [
      'Does a managed service remove all customer security duties?',
      'No. Customer-controlled access, data and configuration still matter.',
    ],
    [
      'Does a small practice-quiz score prove exam readiness?',
      'No. It is limited evidence from that assessment.',
    ],
  ],
};
