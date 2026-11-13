// Run through Playwright MCP browser_run_code_unsafe with this filename.
// All account/history/provider responses are mocked; no database writes or API charges.
async (page) => {
  let signedIn = false;
  let savedMessages = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  await page.route('**/api/auth/session', route => route.fulfill({ json: { user: signedIn ? { id: 'phone-check', displayName: 'Student' } : null } }));
  await page.route('**/api/history', route => route.fulfill({ json: route.request().method() === 'PUT' ? { revision: 1 } : { conversations: savedMessages.length ? [{ id: 'phone-chat', title: 'Long career question '.repeat(10), messages: savedMessages }] : [], revision: 0 } }));
  await page.route('**/api/gemini', route => route.fulfill({ json: { text: 'Try an illustration project this week. What would you like to draw?' } }));
  await page.route('**/api/generate-title', route => route.fulfill({ json: { title: 'Career Exploration' } }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const inspect = async (screen, size) => {
    const result = await page.evaluate(() => {
      const modal = document.querySelector('dialog[open]');
      const controls = [...(modal || document).querySelectorAll('button,a.button,input:not([type=hidden]),select,textarea')].filter(element => element.getClientRects().length && !element.closest('[hidden]'));
      return {
        overflow: document.documentElement.scrollWidth > innerWidth || Boolean(modal && modal.scrollWidth > modal.clientWidth),
        small: controls.filter(element => element.getBoundingClientRect().width < 43.9 || element.getBoundingClientRect().height < 43.9).map(element => element.getAttribute('aria-label') || element.textContent),
        zoomFields: controls.filter(element => element.matches('input,select,textarea') && parseFloat(getComputedStyle(element).fontSize) < 16).map(element => element.id || element.getAttribute('aria-label')),
        hiddenModal: Boolean(document.querySelector('[hidden] dialog[open]')),
      };
    });
    if (result.overflow || result.small.length || result.zoomFields.length || result.hiddenModal) throw new Error(JSON.stringify({ screen, size, ...result }));
    return { screen, ...size };
  };
  const checks = [];
  const sizes = [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 667, height: 375 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }];
  for (const size of sizes) {
    signedIn = false;
    await page.setViewportSize(size);
    await page.goto('http://localhost:3000');
    checks.push(await inspect('landing', size));
    await page.locator('.nav-actions .button-primary').click();
    await page.locator('#auth-password').waitFor();
    checks.push(await inspect('signup', size));
    await page.locator('.auth-tabs button').first().click();
    checks.push(await inspect('login', size));
    await page.getByRole('button', { name: 'Close login dialog' }).click();
    signedIn = true;
    await page.goto('http://localhost:3000/chat');
    await page.waitForFunction(() => document.querySelector('#chat-input') && !document.querySelector('#chat-input').disabled);
    checks.push(await inspect('chat', size));
    if (await page.getByRole('button', { name: 'Open sidebar' }).count()) await page.getByRole('button', { name: 'Open sidebar' }).click();
    checks.push(await inspect('sidebar', size));
    await page.locator('.voice-entry').click();
    await page.locator('.joe-text-form input').waitFor();
    checks.push(await inspect('joe', size));
    await page.locator('.joe-header .button').click();
  }
  // Long saved originals, markdown-like tables and filenames must not widen the phone.
  savedMessages = [{ sender: 'user', text: 'career'.repeat(400), files: ['project'.repeat(100) + '.pdf'] }, { sender: 'bot', text: '| Career | Skills |\n| Design | ' + 'drawing '.repeat(300) + '|\n' + 'Learning plan\n'.repeat(60) }];
  for (const size of [{ width: 320, height: 400 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(size);
    await page.goto('http://localhost:3000/chat');
    await page.waitForFunction(() => document.querySelector('#chat-input') && !document.querySelector('#chat-input').disabled);
    checks.push(await inspect('long-chat', size));
    await page.locator('#chat-input').fill('Help me choose a career.');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await page.getByText('Try an illustration project this week. What would you like to draw?', { exact: true }).waitFor();
    checks.push(await inspect('reply-composer', size));
    const composer = await page.locator('.send-button').boundingBox();
    if (!composer || composer.y < 0 || composer.y + composer.height > size.height) throw new Error('Composer is outside the short viewport');
    await page.getByRole('button', { name: 'Open sidebar' }).click();
    await page.locator('.voice-entry').click();
    await page.locator('.joe-text-form input').fill('I enjoy drawing.');
    await page.locator('.joe-text-form button').click();
    await page.locator('.studio-message.bot').last().waitFor();
    checks.push(await inspect('joe-reply', size));
    await page.locator('.joe-header .button').click();
  }
  signedIn = false;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('http://localhost:3000');
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('.hero-description')).opacity) > .999);
  await page.screenshot({ path: '.playwright-mcp/phone-hero-final.png' });
  const initial = await page.locator('.hero-visual').evaluate(element => getComputedStyle(element).transform);
  await page.mouse.wheel(0, 480);
  await page.waitForFunction(() => scrollY > 300);
  await page.waitForFunction(initial => getComputedStyle(document.querySelector('.hero-visual')).transform !== initial, initial);
  await page.locator('.feature-main').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('.feature-main')).opacity) > .999);
  await page.screenshot({ path: '.playwright-mcp/phone-features-final.png' });
  await page.locator('.topic-panel button').nth(2).click();
  await page.locator('.voice-editorial-copy').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('.voice-editorial-copy')).opacity) > .999);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => [...document.querySelectorAll('.hero-enter,.feature-panel,.explore-intro,.prompt-carousel,.voice-editorial-copy,.hero-visual,.voice-editorial-image')].every(element => parseFloat(getComputedStyle(element).opacity) === 1 && getComputedStyle(element).transform === 'none'));
  await page.locator('.nav-actions .icon-button').click();
  checks.push(await inspect('alternate-theme', { width: 390, height: 844 }));
  await page.screenshot({ path: '.playwright-mcp/phone-theme-final.png' });
  if (errors.length) throw new Error(JSON.stringify(errors));
  return { checks: checks.length, scrollDrift: true, reducedMotionVisibleAndStill: true, errors, mockedAccountHistoryProvider: true };
}
