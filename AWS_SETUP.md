# 이전 AWS Bedrock 연결 기록 (현재 미사용)

현재 앱은 Vercel AI Gateway를 사용합니다. 아래 절차는 실행하지 마세요.

2026-09-24 확인: 도쿄 리전의 `openai.gpt-oss-120b-1:0`은 이 AWS 계정에서 이용 동의·권한·리전 모두 `AVAILABLE`입니다. 그러나 실제 `Converse` 호출은 **AWS 계정 검증 진행 중**이라는 `AccessDeniedException`으로 거부됐습니다. AWS 메시지는 보통 2시간 이내에 완료되며, 이후에도 같으면 `aws-verification@amazon.com`으로 연락하라고 안내합니다. Anthropic 최초 이용 양식은 필요하지 않습니다. 연결된 도구의 IAM 조회·수정은 조직 정책으로 거부되어, 아래 OIDC 공급자와 역할은 AWS 콘솔에서 직접 만들어야 합니다.

1. Vercel 프로젝트 Settings → Security → OIDC에서 issuer가 `Team`인지 확인합니다. 아래 정책은 `Team` 기준입니다. `Global`이면 설정 전에 알려주세요.
2. [AWS IAM 자격 증명 공급자](https://console.aws.amazon.com/iam/home#/identity_providers)에서 OIDC 공급자를 추가합니다. URL `https://oidc.vercel.com/msilot1001s-projects`, Audience `https://vercel.com/msilot1001s-projects`.
3. IAM에서 웹 자격 증명용 새 역할 `history-memory-bedrock`을 만듭니다. 신뢰 정책의 계정 ID 자리에는 본인 AWS 계정 ID를 넣고, 운영 환경의 이 프로젝트만 허용합니다.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/oidc.vercel.com/msilot1001s-projects" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": { "StringEquals": {
      "oidc.vercel.com/msilot1001s-projects:aud": "https://vercel.com/msilot1001s-projects",
      "oidc.vercel.com/msilot1001s-projects:sub": "owner:msilot1001s-projects:project:history-memory-web-v2:environment:production"
    }}
  }]
}
```

4. 역할에 아래 최소 권한 정책을 붙입니다. `gpt-oss-120b` 단일 모델 호출만 허용하며 다른 AWS 리소스 권한은 주지 않습니다.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "bedrock:InvokeModel",
    "Resource": "arn:aws:bedrock:ap-northeast-1::foundation-model/openai.gpt-oss-120b-1:0"
  }]
}
```

5. 생성된 역할 ARN(`arn:aws:iam::…:role/history-memory-bedrock`)만 알려주세요. 비밀 키·암호·접속 코드는 보내지 마세요. Vercel 환경 변수 설정, 운영 재배포, 실제 퀴즈·코칭 검증은 이어서 처리하겠습니다.

AWS 무료 계정 크레딧 $100은 확인했지만 이 모델 비용에 적용되는지는 아직 확인되지 않았습니다. 과금 전 [AWS Bedrock 요금](https://aws.amazon.com/bedrock/pricing/)과 결제 화면을 확인하고 예산 알림을 설정하세요.

근거: [gpt-oss-120b 모델 카드](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-oss-120b.html), [Vercel AWS OIDC 안내](https://vercel.com/docs/oidc/aws).
