export async function snapshot(page, baseUrl, viewport, kind, screenshotPath) {
  await page.setViewportSize(viewport);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  if (kind === 'mobile') await page.locator('#proof').scrollIntoViewIfNeeded();
  if (kind === 'desktop') await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: screenshotPath, fullPage: false });

  return page.evaluate(() => {
    const style = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const computed = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        backgroundColor: computed.backgroundColor,
        borderColor: computed.borderColor,
        borderStyle: computed.borderStyle,
        borderWidth: computed.borderWidth,
        color: computed.color,
        display: computed.display,
        outlineColor: computed.outlineColor,
        outlineStyle: computed.outlineStyle,
        outlineWidth: computed.outlineWidth,
        boxShadow: computed.boxShadow,
        textDecorationLine: computed.textDecorationLine,
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y,
      };
    };
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? null;
    const links = [...document.querySelectorAll('a')].map((link) => ({
      text: link.textContent?.trim() ?? '',
      href: link.getAttribute('href') ?? '',
      className: link.className,
      display: getComputedStyle(link).display,
    }));
    const duplicateIds = [...document.querySelectorAll('[id]')]
      .map((element) => element.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index);
    const unnamedLinks = [...document.querySelectorAll('a')]
      .filter((link) => !(link.getAttribute('aria-label') || link.textContent?.trim())).length;
    return {
      h1: text('#hero-title'),
      h1Count: document.querySelectorAll('h1').length,
      headingCount: document.querySelectorAll('h1, h2').length,
      sectionCount: document.querySelectorAll('main > section').length,
      primaryCount: document.querySelectorAll('.hero-actions .button-primary').length,
      start: style('#start-free'),
      seeHow: style('#see-how'),
      resources: style('[data-nav="resources"]'),
      assuranceOrder: [...document.querySelectorAll('[data-assurance]')]
        .map((element) => element.textContent?.trim() ?? ''),
      assuranceCount: document.querySelectorAll('[data-assurance]').length,
      proofCount: document.querySelectorAll('.proof-card').length,
      proofFirst: style('.proof-card'),
      proofRects: [...document.querySelectorAll('.proof-card')].map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }),
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      links,
      duplicateIds,
      unnamedLinks,
    };
  });
}

export async function interactiveChecks(page, baseUrl) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const requestedButton = page.locator('#see-how');
  await requestedButton.scrollIntoViewIfNeeded();
  await requestedButton.hover();
  const hover = await requestedButton.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { backgroundColor: computed.backgroundColor, color: computed.color };
  });

  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    window.scrollTo(0, 0);
  });
  const focusOrder = [];
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    const item = await page.evaluate(() => ({
      text: document.activeElement?.textContent?.trim() ?? '',
      href: document.activeElement?.getAttribute('href') ?? '',
      className: document.activeElement?.className ?? '',
      id: document.activeElement?.id ?? '',
    }));
    focusOrder.push(item);
    if (item.id === 'see-how') break;
  }
  const focus = await requestedButton.evaluate((element) => {
    const computed = getComputedStyle(element);
    const parent = getComputedStyle(document.body);
    return {
      backgroundColor: computed.backgroundColor,
      color: computed.color,
      outlineColor: computed.outlineColor,
      outlineStyle: computed.outlineStyle,
      outlineWidth: computed.outlineWidth,
      boxShadow: computed.boxShadow,
      parentBackgroundColor: parent.backgroundColor,
      focusVisible: element.matches(':focus-visible'),
    };
  });
  return { hover, focus, focusOrder };
}
