function formatLocalIsoDate(date = new Date()) {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function makeParagraphs(prefix, count) {
  return Array.from({ length: count }, (_, idx) =>
    `${prefix} 第${idx + 1}節。夜空の星図が静かに回り、失われた記録の断片が一つずつ浮かび上がる。これはテスト用の十分な長さを確保するための本文テキストであり、ページ全体のスクロール量と読書進捗バーの計測を安定させる役割を持つ。`
  );
}

function toPlainMockText(text) {
  return String(text ?? "")
    .replace(/\{\{[a-z0-9_]+\|((?:[^}{]|\{[MF]#[^}]*\}|\{(?!\{|[MF]#))+)\}\}/g, "$1")
    .replace(/\{M#([^}]*)\}\{F#([^}]*)\}|\{F#([^}]*)\}\{M#([^}]*)\}/g, (_m, m1, f1, f2, m2) => {
      const male = m1 ?? m2 ?? "";
      const female = f1 ?? f2 ?? "";
      return male === female ? male : `${male}／${female}`;
    });
}

function buildMockSearchIndex(storiesIndex, storyDetails) {
  const stories = {};
  for (const [storyId, detail] of Object.entries(storyDetails)) {
    const termLocs = new Map();
    const chapters = (detail.chapters || []).map((ch, chapterIndex) => {
      const paragraphs = (ch.paragraphs || []).map((p, paragraphIndex) => {
        for (const match of String(p).matchAll(/\{\{([a-z0-9_]+)\|[^}]+\}\}/g)) {
          if (!termLocs.has(match[1])) {
            termLocs.set(match[1], { chapterIndex, paragraphIndex });
          }
        }
        return toPlainMockText(p);
      });
      return {
        chapterIndex,
        partLabel: toPlainMockText(ch.partLabel),
        heading: toPlainMockText(ch.heading),
        epigraph: toPlainMockText(ch.epigraph),
        paragraphs,
        ...(ch.chapterNote ? { chapterNote: toPlainMockText(ch.chapterNote) } : {}),
      };
    });

    const glossary = Object.entries(detail.glossary || {}).map(([termId, entry]) => {
      const loc = termLocs.get(termId) || { chapterIndex: 0, paragraphIndex: 0 };
      return {
        termId,
        term: toPlainMockText(entry.term),
        identity: toPlainMockText(entry.identity),
        desc: toPlainMockText(entry.desc),
        firstChapterIndex: loc.chapterIndex,
        firstParagraphIndex: loc.paragraphIndex,
      };
    });

    const entityNames = (detail.entityIds || [])
      .map((eid) => storiesIndex.entitiesIndex?.[eid]?.name || "")
      .filter(Boolean);

    stories[storyId] = {
      id: storyId,
      title: detail.title,
      hook: detail.hook,
      categoryLabel: detail.categoryLabel,
      era: detail.era,
      region: detail.region || [],
      tags: detail.tags || [],
      entityNames,
      preGuide: (detail.preGuide || []).map((line) => toPlainMockText(line)),
      chapters,
      glossary,
      truth: {
        overallTruth: toPlainMockText(detail.overallTruth),
        gameEffect: toPlainMockText(detail.gameEffect),
      },
    };
  }
  return {
    generatedAt: storiesIndex.generatedAt,
    stories,
  };
}

export function createMockDataset(now = new Date()) {
  const todayStr = formatLocalIsoDate(now);

  const storiesIndex = {
    generatedAt: now.toISOString(),
    totalCount: 3,
    categoryCounts: {
      book: 1,
      artifact: 1,
      weapon: 1,
      attire: 0,
      chronicle: 0,
    },
    entitiesIndex: {
      rosalyne: {
        name: "ロザリン（淑女）",
        kind: "character",
        storyIds: ["mock_witch", "mock_elegy"],
      },
      rostam: {
        name: "ルースタン",
        kind: "character",
        storyIds: ["mock_witch", "mock_elegy"],
      },
      orobashi: {
        name: "オロバシ",
        kind: "god",
        storyIds: ["mock_byakuyakoku"],
      },
    },
    stories: [
      {
        id: "mock_byakuyakoku",
        title: "白夜国館蔵（テスト版）",
        shelfCategory: "book",
        categoryLabel: "書籍（全2巻）",
        region: ["稲妻（淵下宮）"],
        era: "白夜国時代",
        addedAt: "2024-06-01",
        readingTime: "約5分",
        charCount: 2800,
        chapterCount: 2,
        hook: "太陽が沈んだ深海の国で、古代の書記官たちが遺した禁断の年代記——",
        tags: ["淵下宮", "大蛇オロバシ", "全2章"],
        entityIds: ["orobashi"],
      },
      {
        id: "mock_witch",
        title: "燃え盛る炎の魔女（テスト版）",
        shelfCategory: "artifact",
        categoryLabel: "聖遺物（連作短編）",
        region: ["モンド", "スメール"],
        era: "約500年前（漆黒の災厄）",
        addedAt: todayStr,
        readingTime: "約3分",
        charCount: 1200,
        chapterCount: 2,
        hook: "愛する人を失った少女は、涙が枯れた日に自らの身体を「液体の炎」へと変えた——",
        tags: ["ロザリン（淑女）", "500年前の災厄", "時系列順"],
        entityIds: ["rosalyne", "rostam"],
      },
      {
        id: "mock_elegy",
        title: "終焉を嘆く詩（テスト版）",
        shelfCategory: "weapon",
        categoryLabel: "武器ストーリー",
        region: ["モンド"],
        era: "約500年前（漆黒の災厄）",
        addedAt: "2024-01-01",
        readingTime: "約2分",
        charCount: 800,
        chapterCount: 1,
        hook: "帰らぬ恋人を想いながら、モンドを守り抜いて散った一人の騎士の最期——",
        tags: ["ルースタン", "西風騎士団", "短編"],
        entityIds: ["rosalyne", "rostam"],
      },
    ],
  };

  const storyDetails = {
    mock_witch: {
      id: "mock_witch",
      title: "燃え盛る炎の魔女（テスト版）",
      shelfCategory: "artifact",
      categoryLabel: "聖遺物（連作短編）",
      region: ["モンド", "スメール"],
      era: "約500年前（漆黒の災厄）",
      addedAt: todayStr,
      readingTime: "約3分",
      charCount: 1200,
      chapterCount: 2,
      hook: "愛する人を失った少女は、涙が枯れた日に自らの身体を「液体の炎」へと変えた——",
      tags: ["ロザリン（淑女）", "500年前の災厄", "時系列順"],
      entityIds: ["rosalyne", "rostam"],
      preGuide: [
        "舞台：今から約500年前、漆黒の災厄の時代。",
        "主人公：スメールの教令院へ留学していた少女。",
      ],
      overallTruth: "この少女の正体は、後のファデュイ執行官第八位『淑女』ロザリンである。",
      gameEffect: "炎元素ダメージ+15%。",
      connected: [
        {
          targetId: "mock_elegy",
          title: "終焉を嘆く詩（テスト版）",
          relation: "対になる裏視点の物語",
          desc: "恋人ルースタンの視点から描かれた戦いの記録",
        },
      ],
      glossary: {
        cw_lover: {
          term: "時計をくれた人",
          identity: "正体：西風騎士団の副団長「ルースタン」",
          desc: "ロザリンの恋人であり、漆黒の災厄でモンドを守って戦死した騎士。",
          evidence: "武器『終焉を嘆く詩（テスト版）』の記述より",
          evidenceLinks: [
            {
              title: "終焉を嘆く詩（テスト版）",
              storyId: "mock_elegy",
            },
          ],
          entityId: "rostam",
        },
      },
      chapters: [
        {
          partLabel: "第一章（時の砂）",
          heading: "静止した水時計",
          epigraph: "スメールで学業を終える頃、針は止まった。",
          paragraphs: [
            "その時、{{cw_lover|時計をくれた人}}はすでに戦場で命を落としていた。",
            ...makeParagraphs("第一章・魔女", 12),
          ],
          chapterNote: "水時計の停止が悲劇の始まりを示す。",
        },
        {
          partLabel: "第二章（生の花）",
          heading: "炎に包まれた過去",
          epigraph: "かつて炎を操った魔女の願い。",
          paragraphs: [
            ...makeParagraphs("第二章・炎", 12),
          ],
        },
      ],
    },
    mock_elegy: {
      id: "mock_elegy",
      title: "終焉を嘆く詩（テスト版）",
      shelfCategory: "weapon",
      categoryLabel: "武器ストーリー",
      region: ["モンド"],
      era: "約500年前（漆黒の災厄）",
      addedAt: "2024-01-01",
      readingTime: "約2分",
      charCount: 800,
      chapterCount: 1,
      hook: "帰らぬ恋人を想いながら、モンドを守り抜いて散った一人の騎士の最期——",
      tags: ["ルースタン", "西風騎士団", "短編"],
      entityIds: ["rosalyne", "rostam"],
      preGuide: [
        "舞台：500年前のモンド。",
        "主人公：少女を想い続けた西風騎士団の騎士。",
      ],
      overallTruth: "この騎士の正体はルースタン。彼の死が炎の魔女を生む引き金となった。",
      gameEffect: "元素熟知+60。",
      connected: [
        {
          targetId: "mock_witch",
          title: "燃え盛る炎の魔女（テスト版）",
          relation: "表視点の物語",
          desc: "彼の帰りを待ち続けた少女ロザリンの物語",
        },
      ],
      glossary: {
        el_knight: {
          term: "悲しげな騎士",
          identity: "正体：ルースタン",
          desc: "エレンドリンと共に騎士団を支えた副団長。",
          evidence: "聖遺物『燃え盛る炎の魔女（テスト版）』の記録",
          evidenceLinks: [
            {
              title: "燃え盛る炎の魔女（テスト版）",
              storyId: "mock_witch",
            },
          ],
          entityId: "rostam",
        },
      },
      chapters: [
        {
          partLabel: "全一章",
          heading: "風に溶けた詩",
          epigraph: "風神の詩のように美しい弓。",
          paragraphs: [
            "その{{el_knight|悲しげな騎士}}は、少女の帰りを待ちながら剣を振るった。",
            ...makeParagraphs("終焉の詩", 8),
          ],
        },
      ],
    },
    mock_byakuyakoku: {
      id: "mock_byakuyakoku",
      title: "白夜国館蔵（テスト版）",
      shelfCategory: "book",
      categoryLabel: "書籍（全2巻）",
      region: ["稲妻（淵下宮）"],
      era: "白夜国時代",
      addedAt: "2024-06-01",
      readingTime: "約5分",
      charCount: 2800,
      chapterCount: 2,
      hook: "太陽が沈んだ深海の国で、古代の書記官たちが遺した禁断の年代記——",
      tags: ["淵下宮", "大蛇オロバシ", "全2章"],
      entityIds: ["orobashi"],
      preGuide: [
        "舞台：太陽の届かぬ深海・白夜国。",
        "読みどころ：淵下宮の創世記が記されている。",
      ],
      overallTruth: "オロバシは民を守るために自らの死を選んだことが明かされる。",
      gameEffect: "ゲーム内書籍シリーズ（全2巻）。",
      connected: [],
      glossary: {
        by_snake: {
          term: "常世の大蛇",
          identity: "正体：魔神オロバシ",
          desc: "深海に落ちた民を導き、海祇島へと連れ帰った魔神。",
          evidence: "書籍『白夜国館蔵』第二巻",
          entityId: "orobashi",
        },
      },
      chapters: [
        {
          partLabel: "第一巻",
          heading: "日月前事",
          epigraph: "白夜国の歴史書。",
          paragraphs: [
            "【鳩が枝を運んだ年】\n原初の天地が分かれた時代、{{by_snake|常世の大蛇}}はまだ現れていなかった。",
            ...makeParagraphs("日月前事", 10),
          ],
          chapterNote: "淵下宮特有の紀年法が記されている。",
        },
        {
          partLabel: "第二巻",
          heading: "蛇と民の契約",
          epigraph: "光を求める者たちの歌。",
          paragraphs: [
            ...makeParagraphs("第二巻", 10),
          ],
        },
      ],
    },
  };

  const searchIndex = buildMockSearchIndex(storiesIndex, storyDetails);

  return { storiesIndex, searchIndex, storyDetails };
}

export async function setupMockApi(page, options = {}) {
  const { dataset = createMockDataset(), failOnceIds = new Set() } = options;
  const failedAttempted = new Set();

  // Route HTML document navigations through SPA fallback so mocked /data/* payloads drive E2E tests
  await page.route("**/*", async (route) => {
    const req = route.request();
    if (req.resourceType() !== "document") {
      return route.fallback();
    }
    const url = new URL(req.url());
    if (
      url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/data/") ||
      url.pathname === "/__spa-fallback.html" ||
      /\.[a-z0-9]+$/i.test(url.pathname)
    ) {
      return route.fallback();
    }
    const fallbackRes = await route.fetch({
      url: new URL("/__spa-fallback.html", url.origin).toString(),
    });
    const body = await fallbackRes.body();
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body,
    });
  });

  // Prevent flaky/slow external Google Fonts requests during headless tests
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) =>
    route.abort()
  );

  await page.route("**/data/stories-index.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(dataset.storiesIndex),
    });
  });

  await page.route("**/data/search-index.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(dataset.searchIndex),
    });
  });

  await page.route("**/data/stories/*.json", async (route) => {
    const url = new URL(route.request().url());
    const match = /\/data\/stories\/([^/]+)\.json$/.exec(url.pathname);
    const storyId = match ? decodeURIComponent(match[1]) : "";

    if (failOnceIds.has(storyId) && !failedAttempted.has(storyId)) {
      failedAttempted.add(storyId);
      await route.fulfill({
        status: 500,
        contentType: "text/plain; charset=utf-8",
        body: "Simulated server error",
      });
      return;
    }

    const story = dataset.storyDetails[storyId];
    if (!story) {
      await route.fulfill({
        status: 404,
        contentType: "text/plain; charset=utf-8",
        body: "Not found",
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(story),
    });
  });
}
