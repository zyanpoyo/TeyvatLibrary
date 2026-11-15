# 『テイワット文庫』SEOメタタグ＆一節引用シェア機能 実装仕様書（Cloudflare Pages構成）

本仕様書は、**Cloudflare Pages（静的サイト生成 / SSG + Cloudflare Pages Functions）** の無料枠・低コスト運用を前提とし、Google検索でのニッチキーワード上位表示と、X（旧Twitter）での「一節引用カード（動的OGP）」による拡散を実現するための技術仕様書です。

## 1. アーキテクチャ概要（Cloudflare Pages 構成）

平常時のストーリー閲覧はすべて**静的HTML + 静的JSON（SSG）**として配信し、CloudflareのCDNキャッシュを100%効かせることでFunction課金・DB課金をゼロに抑えます。X（旧Twitter）のクローラー（`Twitterbot`）や一節引用シェア画像の生成リクエスト時のみ **Cloudflare Pages Functions（Edge Worker）** を起動するハイブリッド構成を採用します（[Zenn](https://zenn.dev/chocolat5/articles/64de392a7132d4)、[WP-Kyoto](https://wp-kyoto.net/generate-dynamic-opengraph-image-on-cloudflare-pages)）。

| コンポーネント | 技術スタック / パス | 役割・コスト最適化のポイント |
| :--- | :--- | :--- |
| **ストーリー閲覧ページ（SSG）** | `/artifacts/[slug]/index.html`<br>`/books/[slug]/index.html`<br>`/weapons/[slug]/index.html` | ビルド時に全作品の `<title>`、`description`、JSON-LD、本文、インライン用語集を静的HTMLとして出力し、Googlebotに100%インデックスさせる（[Qiita](https://qiita.com/yuno_miyako/items/6e5ffa31800e05781e7c)）。 |
| **メタタグ書き換え Middleware** | `/functions/artifacts/[slug].ts`<br>（`HTMLRewriter` 使用） | URLに引用パラメータ（`?q=c1-p2` 等）が付与されている場合のみ、Cloudflare内蔵の `HTMLRewriter` で `og:image` と `og:description` を引用箇所専用に高速書き換えする。 |
| **動的OGP画像生成 API** | `/functions/api/og.tsx`<br>（`@cloudflare/pages-plugin-vercel-og`） | 選択された一節（段落ID）と作品タイトルを受け取り、1200×630pxの引用カード画像をエッジで動的生成し、`Cache-Control` ヘッダーでCDNキャッシュする（[Zenn](https://zenn.dev/hiromu617/articles/c03fef6f4d6c6e)、[PLAN-B](https://www.plan-b.co.jp/blog/marketing/29096/)）。 |

## 2. SEO用メタタグ＆命名規則仕様

大手攻略サイト（[GameWith](https://gamewith.jp/genshin/article/show/232148)・[Game8](https://game8.jp/genshin/623138)など）がカバーしていない**「アイテム名 × ストーリー・全文・考察・関連キャラ名」**の複合クエリを確実に拾うためのテンプレートです。

### 2.1 カテゴリ別 `<title>` / `<meta name="description">` ルール

| カテゴリ | `<title>` テンプレート（32〜45文字目安） | `<meta name="description">` テンプレート（90〜120文字目安） |
| :--- | :--- | :--- |
| **聖遺物** | `【原神】聖遺物「{聖遺物名}」ストーリー全文・用語解説｜{関連キャラ・テーマ}の過去【テイワット文庫】` | `原神の聖遺物「{聖遺物名}」の5部位（生の花〜理の冠）のストーリー全文を1ページで小説感覚で一気読み。{3行あらすじの要約}。登場する「{重要用語1}」「{重要用語2}」の用語解説付き。` |
| **書籍** | `【原神】書籍「{書籍名}」全巻テキストまとめ・あらすじ解説｜{サブテーマ}【テイワット文庫】` | `原神のゲーム内書籍「{書籍名}（全{N}巻）」の本文テキストと3行あらすじまとめ。{3行あらすじの要約}。難解な固有名詞（{重要用語1}・{重要用語2}）のインライン辞書付きで手軽に読めます。` |
| **武器** | `【原神】武器「{武器名}」ストーリー全文・考察解説｜{モチーフキャラ・関連勢力}【テイワット文庫】` | `原神の{武器種}「{武器名}」の武器ストーリー（突破前・突破後）全文と背景解説。{3行あらすじの要約}。関連する書籍や聖遺物ストーリーとの繋がりもあわせて読めます。` |
| **特集棚** | `【原神考察】{特集タイトル}｜関連する聖遺物・書籍・武器ストーリー読む順番まとめ【テイワット文庫】` | `{特集テーマ}に関する原神の書籍・聖遺物・武器ストーリーを時系列・読む順番にまとめた特集プレイリスト。{収録作品リスト}を用語解説付きで一気読みできます。` |

### 2.2 HTML `<head>` 実装サンプル（例：聖遺物『燃え盛る炎の魔女』）

```html
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  
  <!-- 1. 基本SEOメタタグ -->
  <title>【原神】聖遺物「燃え盛る炎の魔女」ストーリー全文・用語解説｜淑女シニョーラ（ロザリン）の過去【テイワット文庫】</title>
  <meta name="description" content="原神の聖遺物「燃え盛る炎の魔女」の5部位（魔女の炎の花〜焦げた魔女の帽子）のストーリー全文を小説感覚で一気読み。ファデュイ執行官第八位「淑女」シニョーラ（ロザリン）が炎の魔女へと変貌した悲劇の過去を、ルスタムや厄災などのインライン用語解説付きで収録。" />
  <!-- 引用パラメータ(?q=...)付きURLが重複インデックスされないよう正規URLを固定 -->
  <link rel="canonical" href="https://teyvat-bunko.pages.dev/artifacts/crimson-witch-of-flames" />

  <!-- 2. OGP / X (Twitter) Card タグ（XServer・PLAN-B推奨の1200x630 large image仕様） -->
  <meta property="og:site_name" content="テイワット文庫" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://teyvat-bunko.pages.dev/artifacts/crimson-witch-of-flames" />
  <meta property="og:title" content="聖遺物「燃え盛る炎の魔女」ストーリー全文｜淑女シニョーラの過去【テイワット文庫】" />
  <meta property="og:description" content="5部位に分かれた聖遺物テキストを1本の短編として一気読み。設定用語のワンタップ解説付き。" />
  <meta property="og:image" content="https://teyvat-bunko.pages.dev/api/og?type=artifact&slug=crimson-witch-of-flames" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="聖遺物「燃え盛る炎の魔女」ストーリー全文｜淑女シニョーラの過去【テイワット文庫】" />
  <meta name="twitter:description" content="5部位に分かれた聖遺物テキストを1本の短編として一気読み。設定用語のワンタップ解説付き。" />
  <meta name="twitter:image" content="https://teyvat-bunko.pages.dev/api/og?type=artifact&slug=crimson-witch-of-flames" />
</head>
```

## 3. JSON-LD 構造化データ仕様（検索エンジン＆AI検索最適化）

Google検索のリッチリザルト（パンくずリスト・記事情報）およびAI検索（AI Overviews等）が「この記事はどのキャラクター・どの専門用語について解説しているか」を正確に構造化理解できるよう、`Article`、`BreadcrumbList`、および用語解説を示す `DefinedTerm` を1つの `@graph` で出力します（[Alice Labs](https://alicelabs.ai/en/insights/schema-org-for-ai)、[Technova](https://technovapartners.com/en/insights/structured-data-schema-seo-2026)）。
※なお、Google検索における `FAQPage` のリッチリザルト表示は廃止されているため（[Gemeos Agency](https://www.gemeosagency.com/en/blog/structured-data)）、無理にFAQ形式にするよりも `about` / `mentions` プロパティにキャラ名・用語（`DefinedTerm`）を明記する方が検索意図に直結します。

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "テイワット文庫",
          "item": "https://teyvat-bunko.pages.dev/"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "聖遺物ストーリー一覧",
          "item": "https://teyvat-bunko.pages.dev/artifacts"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": "燃え盛る炎の魔女",
          "item": "https://teyvat-bunko.pages.dev/artifacts/crimson-witch-of-flames"
        }
      ]
    },
    {
      "@type": "Article",
      "headline": "【原神】聖遺物「燃え盛る炎の魔女」ストーリー全文・用語解説｜淑女シニョーラ（ロザリン）の過去",
      "description": "原神の聖遺物「燃え盛る炎の魔女」5部位のストーリー全文と3行あらすじ、固有名詞の解説。",
      "image": "https://teyvat-bunko.pages.dev/api/og?type=artifact&slug=crimson-witch-of-flames",
      "datePublished": "2026-11-15T00:00:00+09:00",
      "dateModified": "2026-11-15T00:00:00+09:00",
      "inLanguage": "ja",
      "isPartOf": {
        "@type": "WebSite",
        "name": "テイワット文庫",
        "url": "https://teyvat-bunko.pages.dev/"
      },
      "about": [
        {
          "@type": "Person",
          "name": "シニョーラ",
          "alternateName": ["淑女", "ロザリン・クルーズチカ・ローエファルター", "燃え盛る炎の魔女"]
        }
      ],
      "mentions": [
        {
          "@type": "DefinedTerm",
          "name": "ルスタム",
          "description": "500年前のモンドの西風騎士団副団長（幼狼）。ロザリンの恋人であり、カンルイアの厄災との戦いで命を落とした。"
        },
        {
          "@type": "DefinedTerm",
          "name": "道化（ピエロ）",
          "description": "ファデュイ執行官の統括官。自らの炎で身を焼き尽くそうとしていた炎の魔女を勧誘し、邪眼を授けた。"
        }
      ]
    }
  ]
}
</script>
```

## 4. 「一節引用シェア機能」のエンドツーエンド実装仕様

ユーザーが本文中の好きな一節（段落）を選んでX（旧Twitter）にシェアした際、**「長大なクエリ文字列によるURL汚染」や「任意の文字列注入によるOGP画像の悪用（スパム画像生成）」を防ぐ**ため、本文の各段落に固有のID（例：`c1-p2`＝第1章・第2段落）を割り振る設計にします。

### 4.1 静的JSONデータの構造（`/public/data/artifacts/crimson-witch-of-flames.json`）

```json
{
  "slug": "crimson-witch-of-flames",
  "category": "artifact",
  "title": "燃え盛る炎の魔女",
  "relatedCharacters": ["淑女（シニョーラ）", "ロザリン", "ルスタム"],
  "summary3Lines": [
    "500年前の厄災で最愛の恋人ルスタムを失った少女ロザリンが、液体の炎で自らを焼き「燃え盛る炎の魔女」となる物語。",
    "人間を傷つけることなく魔物だけを焼き続けた彼女が、やがてファデュイの「道化」と出会い執行官「淑女」となるまでの軌跡。",
    "魔神任務の稲妻編では語られなかった、彼女の哀しみと狂気の原点が5つの部位を通して描かれる。"
  ],
  "chapters": [
    {
      "chapterId": "c1",
      "partName": "生の花",
      "title": "魔女の炎の花",
      "paragraphs": [
        {
          "id": "c1-p1",
          "text": "かつて世の中を焼き尽くす夢を見た魔女が最後に残した炎の花。無情な炎は触れる者を優しく撫でる。"
        },
        {
          "id": "c1-p2",
          "text": "「私はもう夢を見ない。歌うこともない。私の涙はとうに乾ききってしまった。」"
        }
      ]
    }
  ]
}
```

### 4.2 フロントエンド（引用ボタン＆Web Share / X Intent生成）

各段落（`<p data-pid="c1-p2">`）をタップ、またはテキスト選択時にミニツールバー「この一節をXで引用する」を表示します。

```typescript
// 一節引用シェアURL生成関数
export function openQuoteShareToX(params: {
  slug: string;
  category: 'artifacts' | 'books' | 'weapons';
  title: string;
  chapterTitle: string;
  paragraphId: string;
  quoteText: string;
  relatedChar?: string;
}) {
  const baseUrl = 'https://teyvat-bunko.pages.dev';
  // パラメータは段落ID(q=c1-p2)のみを渡し、URLを短くクリーンに保つ
  const shareUrl = `${baseUrl}/${params.category}/${params.slug}?q=${encodeURIComponent(params.paragraphId)}#${params.paragraphId}`;

  // 80文字を超える場合は省略記号を付与
  const trimmedQuote =
    params.quoteText.length > 80 ? `${params.quoteText.slice(0, 79)}…` : params.quoteText;

  // Xのキーワード検索にヒットしやすいよう、作品名・関連キャラ名・ハッシュタグを自動セット
  const charTag = params.relatedChar ? `（${params.relatedChar}）` : '';
  const postText = `“${trimmedQuote}”\n— 『${params.title}』${params.chapterTitle}${charTag}\n`;
  const hashtags = '原神,原神考察,テイワット文庫';

  const intentUrl = new URL('https://twitter.com/intent/tweet');
  intentUrl.searchParams.set('text', postText);
  intentUrl.searchParams.set('url', shareUrl);
  intentUrl.searchParams.set('hashtags', hashtags);

  window.open(intentUrl.toString(), '_blank', 'noopener,noreferrer');
}
```

### 4.3 Edgeでの動的メタタグ書き換え（Cloudflare Pages Functions + `HTMLRewriter`）

シェアされたURL（`/artifacts/crimson-witch-of-flames?q=c1-p2`）にXのクローラーがアクセスした際、静的なHTMLをベースにしつつ、`q` パラメータが存在する場合のみ `og:image` の向き先を引用画像生成APIへ差し替えます。

```typescript
// /functions/artifacts/[slug].ts
export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const quoteId = url.searchParams.get('q');
  const slug = context.params.slug as string;

  // 通常の静的HTMLアセットを取得
  const response = await context.env.ASSETS.fetch(context.request);

  // ?q= パラメータがない通常アクセスは、そのまま静的HTMLを返す（エッジ負荷ゼロ）
  if (!quoteId) {
    return response;
  }

  // ?q= がある場合のみ、OGP画像URLに q パラメータを引き継ぐ
  const ogImageUrl = `${url.origin}/api/og?type=artifacts&slug=${encodeURIComponent(slug)}&q=${encodeURIComponent(quoteId)}`;

  return new HTMLRewriter()
    .on('meta[property="og:image"]', {
      element(el) {
        el.setAttribute('content', ogImageUrl);
      },
    })
    .on('meta[name="twitter:image"]', {
      element(el) {
        el.setAttribute('content', ogImageUrl);
      },
    })
    .transform(response);
};
```

### 4.4 動的OGP画像の生成エンドポイント（`@cloudflare/pages-plugin-vercel-og`）

Cloudflare Pages Functions環境で動作する `@cloudflare/pages-plugin-vercel-og` の `ImageResponse` を使用し、静的JSONから該当する段落テキストを引き当てて、星空・羊皮紙テイストの引用カード画像（1200×630px）を生成します（[Zenn](https://zenn.dev/chocolat5/articles/64de392a7132d4)）。

```tsx
// /functions/api/og.tsx
import { ImageResponse } from '@cloudflare/pages-plugin-vercel-og/api';

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const type = url.searchParams.get('type') || 'artifacts';
  const slug = url.searchParams.get('slug') || '';
  const quoteId = url.searchParams.get('q') || '';

  // 1. 自身の静的JSONアセットからストーリーデータを取得
  const dataRes = await context.env.ASSETS.fetch(
    new URL(`/data/${type}/${slug}.json`, url.origin)
  );
  if (!dataRes.ok) {
    return new Response('Not Found', { status: 404 });
  }
  const storyData: any = await dataRes.json();

  // 2. quoteIdが指定されていれば該当段落を検索、なければ3行あらすじの1行目を表示
  let displayQuote = storyData.summary3Lines?.[0] || storyData.title;
  let chapterLabel = '全文・用語解説';

  if (quoteId) {
    for (const ch of storyData.chapters || []) {
      const found = ch.paragraphs?.find((p: any) => p.id === quoteId);
      if (found) {
        displayQuote = found.text;
        chapterLabel = `${ch.partName}「${ch.title}」より`;
        break;
      }
    }
  }

  // 3. 日本語明朝体フォント（Noto Serif JP サブセット等）を静的アセットから読み込み
  const fontRes = await context.env.ASSETS.fetch(
    new URL('/fonts/NotoSerifJP-SemiBold.otf', url.origin)
  );
  const fontData = await fontRes.arrayBuffer();

  // 4. 1200x630px の引用カード画像をレンダリング（CDNキャッシュを長期設定して再計算を防止）
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px',
          backgroundColor: '#0f1423',
          backgroundImage: 'radial-gradient(circle at 20% 20%, #1e2942 0%, #0a0e17 100%)',
          color: '#f4efe6',
          fontFamily: '"Noto Serif JP"',
          border: '2px solid #c8aa6e',
        }}
      >
        {/* 上部：作品タイトルと部位・章名 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '28px', color: '#c8aa6e' }}>
            『{storyData.title}』 — {chapterLabel}
          </span>
        </div>

        {/* 中央：引用テキスト本文 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: displayQuote.length > 70 ? '34px' : '42px',
            lineHeight: 1.6,
            letterSpacing: '0.04em',
            color: '#ffffff',
          }}
        >
          “{displayQuote}”
        </div>

        {/* 下部：サイトブランディング */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(200, 170, 110, 0.4)',
            paddingTop: '24px',
          }}
        >
          <span style={{ fontSize: '24px', color: '#94a3b8' }}>
            関連：{storyData.relatedCharacters?.join(' / ')}
          </span>
          <span style={{ fontSize: '28px', color: '#c8aa6e' }}>
            テイワット文庫
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Noto Serif JP',
          data: fontData,
          style: 'normal',
          weight: 600,
        },
      ],
      headers: {
        // 一度生成した引用画像はCloudflareエッジに7日間キャッシュし、Function実行回数を節約
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    }
  );
};
```

## 5. デプロイ前チェックリスト

1. **日本語フォントのサブセット化**：Cloudflare Pages Functionsにはスクリプトサイズ制限があるため、OGP生成用の明朝体フォント（`NotoSerifJP` 等）はJIS第1・第2水準＋原神頻出漢字にサブセット化した軽量ファイル（約1〜2MB以下）を `/public/fonts/` に配置し、`ASSETS.fetch()` で読み込むこと（[Zenn](https://zenn.dev/chocolat5/articles/64de392a7132d4)）。
2. **`canonical` タグによるURL正規化**：`?q=c1-p2` などの引用シェア用クエリパラメータ付きURLがGoogleに別ページとして重複インデックスされるのを防ぐため、`<link rel="canonical">` は常にパラメータなしのベースURLに固定すること。
3. **検証ツールでの事前テスト**：リリース前に Google の「リッチリザルトテスト」と「Schema Markup Validator」でJSON-LDを検証し（[Technova](https://technovapartners.com/en/insights/structured-data-schema-seo-2026)）、Xのカード表示確認（Card Validator / 下書きプレビュー）で1200×630pxの画像がキャッシュヘッダー付きで即座に返ることを確認すること（[PLAN-B](https://www.plan-b.co.jp/blog/marketing/29096/)）。
