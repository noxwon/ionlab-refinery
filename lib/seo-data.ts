export const SITE_URL = "https://refinery.techplay.blog";
export const SITE_NAME = "이온랩 리파이너리 (IONLAB REFINERY)";
export const COMPANY_NAME = "주식회사 이온랩 (IONLAB Co., Ltd.)";

export const SEO_TITLE =
  "이온랩 리파이너리 (IONLAB REFINERY) | 1kg 소량 금 추출 위탁 정련 · 금도금 핀 · IC 칩 순금 회수 전문";

export const SEO_DESCRIPTION =
  "특허출원 제10-2026-0182129호 기반 1kg 소량 모재 1인 1배치 단독 습식 금 추출·위탁 정련 센터. 금도금 핀·단자·커넥터(1일 완성, 기본 13만원), IC·BGA 반도체 칩(2일 완성, 기본 23만원) 정찰제 공임과 단계별 실측 영상·사진 로그 공개로 고순도(98.5~99.5%) 순금을 투명하게 회수합니다.";

export const SEO_KEYWORDS: string[] = [
  "금 추출",
  "금 정련",
  "소량 금 정련",
  "금 위탁 정련",
  "금 임가공",
  "금도금 핀 금 추출",
  "금도금 커넥터 정련",
  "금도금 단자 순금 회수",
  "IC 칩 금 추출",
  "BGA 칩 금 정련",
  "반도체 칩 금 회수",
  "PCB 금 추출",
  "전자스크랩 금 추출",
  "불량 칩 금 회수",
  "도시광산 금 정련",
  "습식 금 정련",
  "순금 비드 추출",
  "골드 버튼 정련",
  "고순도 금 추출",
  "금 스크랩 정련 비용",
  "금 추출 시뮬레이터",
  "평택 금 정련소",
  "주식회사 이온랩",
  "이온랩 리파이너리",
  "IONLAB REFINERY",
  "KRX 금시세 정산",
  "전자부품 금 회수",
  "도금 박리 정련",
];

export interface SeoFaqItem {
  question: string;
  answer: string;
  category: string;
}

export const SEO_FAQ_ITEMS: SeoFaqItem[] = [
  {
    category: "최소 물량 · 입고 기준",
    question: "소량 금도금 핀·커넥터나 IC/BGA 반도체 칩도 단 1kg부터 위탁 정련이 가능한가요?",
    answer:
      "네, 가능합니다. 대형 제련소는 수백 kg 이상의 물량만 취급하지만, 주식회사 이온랩(IONLAB REFINERY)은 특허출원(제10-2026-0182129호) 기반 정밀 소규모 습식 반응 설비를 통해 최소 1kg(1,000g)부터 1인 1배치 단독 공정으로 고순도 순금을 추출해 드립니다.",
  },
  {
    category: "수익성 비교",
    question: "일반 스크랩 매입상에게 넘기는 것과 이온랩 위탁 정련(임가공)은 무엇이 다른가요?",
    answer:
      "일반 매입상은 금 함유량을 눈대중으로 낮게 어림잡아 시세의 50~70% 수준으로 일괄 매입하는 경우가 많습니다. 반면 이온랩 위탁 정련은 투명한 정찰제 공임(금도금 1kg 기본 13만원, IC/BGA 칩 1kg 기본 23만원)만 받고, 실제 추출된 고순도 순금(98.5~99.5% 골드 비드) 전량을 의뢰인께 귀속시켜 수익을 극대화합니다.",
  },
  {
    category: "소요 시간 · 순도",
    question: "정련 작업 소요 시간(당일 1일 완성 기준)과 추출되는 금의 순도는 어떻게 되나요?",
    answer:
      "금도금 모재(핀·단자·커넥터)는 당일 오전 11시까지 입고·접수된 건에 한해 24시간(1일) 내 순금 추출이 완료되며, 에폭시 탄화 및 미분쇄·다중여과가 필요한 IC/BGA 칩 모재는 48시간(2일) 내에 완료됩니다. 기본 공정으로 추출되는 골드 비드(Gold Button)의 순도는 가성비와 회수율이 가장 뛰어난 98.5% ~ 99.5%이며, 99.9% 초고순도 정제가 필요한 경우 별도 상담을 통해 진행합니다.",
  },
  {
    category: "공정 투명성 · 단독 배치",
    question: "내 모재가 다른 의뢰인의 물량과 섞이지 않나요? 작업 과정은 어떻게 확인하나요?",
    answer:
      "이온랩은 1의뢰인 1단독 반응조(1-Client 1-Batch) 원칙을 엄격히 준수하여 타 물량과의 혼입이 원천적으로 불가능합니다. 또한 STEP 01(입금 확인 및 전자저울 입고 모재 실측 계량)부터 STEP 02(습식 침출·환원), STEP 03(순금 비드 용융 및 0.01g 단위 확정 계량), STEP 04(최종 정산·출고)까지 전 단계의 현장 사진과 영상을 전용 트래커 페이지에서 실시간으로 열람하실 수 있습니다.",
  },
  {
    category: "요금 체계 · 전처리",
    question: "그램(g) 단위 추가 요금과 납땜·방열판 전처리 비용은 어떻게 계산되나요?",
    answer:
      "1kg 초과 물량은 1g 단위로 정밀 비례 계산되어 합리적입니다. 금도금 모재는 기본 1kg 130,000원(추가 +30,000원/kg, 주석·납땜 제거 전처리 선택 시 +15,000원/kg), IC/BGA 칩 모재는 기본 1kg 230,000원(추가 +60,000원/kg, 구리 방열판 히트스프레더 해체 선택 시 +25,000원/kg)이 적용됩니다. 물량이 늘어날수록 kg당 단가가 대폭 낮아집니다.",
  },
  {
    category: "정산 방식 · 세무 처리",
    question: "추출된 순금은 실물(Gold Button) 수령과 현금 계좌이체 정산 중 선택할 수 있나요?",
    answer:
      "네, 두 가지 방식 모두 지원합니다. 1) 순금 실물 수령 선택 시 우체국 안심소포(보험등기) 택배 발송 또는 평택 정련실 직접 방문 수령이 가능하며, 2) 현금 정산 선택 시 KRX 실시간 금시세를 기준으로 작업비를 차감한 금액을 의뢰인 본인 명의 계좌로 즉시 송금해 드립니다(개인 3.3% 사업소득 원천징수, 비사업자 일시 처분 지출증빙, 사업자 세금계산서 모두 지원).",
  },
];

export const SEO_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      alternateName: ["이온랩 정련소", "IONLAB REFINERY", "주식회사 이온랩 금 추출 센터"],
      description: SEO_DESCRIPTION,
      inLanguage: "ko-KR",
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
    },
    {
      "@type": ["Organization", "LocalBusiness", "ProfessionalService"],
      "@id": `${SITE_URL}/#organization`,
      name: COMPANY_NAME,
      alternateName: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      image: `${SITE_URL}/og-image.svg`,
      description: SEO_DESCRIPTION,
      telephone: "+82-10-5798-0188",
      email: "techplay.blog@gmail.com",
      priceRange: "₩130,000 - ₩500,000",
      taxID: "272-87-04029",
      founder: {
        "@type": "Person",
        name: "원홍식",
      },
      address: {
        "@type": "PostalAddress",
        streetAddress: "고덕면 도시지원1길 116, 208호 (평택 G1지식산업센터)",
        addressLocality: "평택시",
        addressRegion: "경기도",
        postalCode: "17782",
        addressCountry: "KR",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 37.0456,
        longitude: 127.0561,
      },
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          opens: "09:00",
          closes: "18:00",
        },
      ],
      knowsAbout: [
        "귀금속 습식 정련 (Hydrometallurgical Gold Refining)",
        "금도금 핀 및 커넥터 순금 회수",
        "IC 및 BGA 반도체 패키지 금 추출",
        "특허출원 제10-2026-0182129호 정밀 금 회수 공정",
      ],
    },
    {
      "@type": "Service",
      "@id": `${SITE_URL}/#service`,
      name: "소규모 고순도 금 추출 위탁 정련 (임가공) 서비스",
      serviceType: "Precious Metal Refining & Electronic Scrap Gold Recovery",
      provider: {
        "@id": `${SITE_URL}/#organization`,
      },
      areaServed: {
        "@type": "Country",
        name: "대한민국 (South Korea)",
      },
      description:
        "단 1kg의 소량 금도금 핀·커넥터·단자 및 IC/BGA 칩 모재를 1인 1배치 단독 습식 공정으로 정련하여 고순도(98.5~99.5%) 순금 비드로 회수하는 투명한 위탁 정련 서비스.",
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "이온랩 표준 정련 요금표",
        itemListElement: [
          {
            "@type": "Offer",
            name: "Track 1 · 금도금 모재 (핀·단자·커넥터) 1일 완성 위탁 정련",
            description:
              "기본 1kg(1,000g) 130,000원 (기술료 5만 + 인건비 6만 + 약품 실비 2만). 1kg 초과 시 +30,000원/kg(g단위 비례), 납땜 제거 전처리 +15,000원/kg. 당일 오전 11시까지 접수분 당일 완성.",
            price: "130000",
            priceCurrency: "KRW",
            availability: "https://schema.org/InStock",
            url: `${SITE_URL}/#pricing`,
          },
          {
            "@type": "Offer",
            name: "Track 2 · IC / BGA 반도체 칩 모재 2일 완성 위탁 정련",
            description:
              "기본 1kg(1,000g) 230,000원 (특수기술료 7만 + 2일 인건비 12만 + 탄화·약품 실비 4만). 1kg 초과 시 +60,000원/kg(g단위 비례), 방열판 제거 전처리 +25,000원/kg. 48시간 정밀 공정.",
            price: "230000",
            priceCurrency: "KRW",
            availability: "https://schema.org/InStock",
            url: `${SITE_URL}/#pricing`,
          },
        ],
      },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#simulator`,
      name: "이온랩 그램(g) 단위 금 정련 비용 & 기대수익 실시간 시뮬레이터",
      url: `${SITE_URL}/#simulator`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "All",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "KRW",
      },
      description:
        "KRX 한국거래소 실시간 금시세와 연동하여 모재 중량(1,000g~5,000g) 및 예상 금 추출량(0.1g 단위)에 따른 정련 비용과 의뢰인 순수익을 즉시 계산하는 웹 시뮬레이터.",
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: SEO_FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ],
};
