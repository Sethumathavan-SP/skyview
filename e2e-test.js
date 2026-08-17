const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = 'C:\\workSpace\\Project\\Trilogy\\Skyview\\screenshots';

async function runTest(dateLabel, dateValue, fillForm) {
  // Ensure screenshots directory exists
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  console.log(`\n========== TEST: ${dateLabel} ==========`);
  console.log(`STEP 1: Navigating to http://localhost:5173...`);
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${dateLabel}-01-initial-form.png`), fullPage: true });
  console.log(`Screenshot saved: ${dateLabel}-01-initial-form.png`);

  // Verify form fields
  const formFields = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label')).map(l => l.textContent.trim());
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type,
      name: i.name,
      id: i.id,
      placeholder: i.placeholder
    }));
    const button = document.querySelector('button[type="submit"]');
    return { labels, inputs, buttonText: button ? button.textContent.trim() : null };
  });
  console.log('Form fields found:', formFields);

  // STEP 2: Fill in the form
  console.log(`\nSTEP 2: Filling form for ${dateLabel}...`);
  await fillForm(page);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${dateLabel}-02-filled-form.png`), fullPage: true });
  console.log(`Screenshot saved: ${dateLabel}-02-filled-form.png`);

  // STEP 3: Click "Get Recommendation"
  console.log(`\nSTEP 3: Clicking Get Recommendation...`);
  await page.click('button[type="submit"]');

  // Wait for recommendation card to appear
  try {
    await page.waitForSelector('.recommendation-card', { timeout: 15000 });
    console.log('Recommendation card appeared');
  } catch (e) {
    console.log('Recommendation card did not appear within 15 seconds');
    const pageContent = await page.content();
    console.log('Page content:', pageContent.substring(0, 3000));
  }

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${dateLabel}-03-recommendation-result.png`), fullPage: true });
  console.log(`Screenshot saved: ${dateLabel}-03-recommendation-result.png`);

  // STEP 4: Verify recommendation card content
  console.log(`\nSTEP 4: Verifying recommendation card...`);
  const cardText = await page.evaluate(() => {
    const card = document.querySelector('.recommendation-card');
    return card ? card.innerText : 'CARD NOT FOUND';
  });
  console.log('Card text content:');
  console.log(cardText);
  const hasLeft = cardText.toLowerCase().includes('left');
  const hasRight = cardText.toLowerCase().includes('right');
  const hasHigh = cardText.toLowerCase().includes('high');
  const hasLow = cardText.toLowerCase().includes('low');
  const hasMedium = cardText.toLowerCase().includes('medium');
  const hasFlightInfo = cardText.includes('UA2369') || cardText.includes('IAH') || cardText.includes('ANC');
  console.log(`Contains "left": ${hasLeft}`);
  console.log(`Contains "right": ${hasRight}`);
  console.log(`Contains confidence (high/low/medium): ${hasHigh || hasLow || hasMedium}`);
  console.log(`Contains flight_info: ${hasFlightInfo}`);

  // STEP 5: Check map
  console.log(`\nSTEP 5: Checking map...`);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${dateLabel}-04-map-view.png`), fullPage: true });
  console.log(`Screenshot saved: ${dateLabel}-04-map-view.png`);

  const mapInfo = await page.evaluate(() => {
    const mapContainer = document.querySelector('.leaflet-container');
    const tiles = document.querySelectorAll('.leaflet-tile');
    const path = document.querySelector('.leaflet-overlay-pane svg path') || document.querySelector('.leaflet-overlay-pane path');
    const markers = document.querySelectorAll('.leaflet-marker-icon');
    return {
      mapContainerExists: !!mapContainer,
      mapContainerVisible: mapContainer ? window.getComputedStyle(mapContainer).display !== 'none' && mapContainer.offsetWidth > 0 : false,
      tileCount: tiles.length,
      pathExists: !!path,
      markerCount: markers.length
    };
  });
  console.log('Map info:', mapInfo);

  // STEP 6: Move slider to midpoint
  console.log(`\nSTEP 6: Moving slider to midpoint...`);
  const sliderInfo = await page.evaluate(() => {
    const slider = document.querySelector('input[type="range"]');
    if (!slider) return { found: false };
    const min = parseInt(slider.min, 10);
    const max = parseInt(slider.max, 10);
    const mid = Math.floor((min + max) / 2);
    return { found: true, min, max, mid };
  });
  console.log('Slider info:', sliderInfo);

  if (sliderInfo.found) {
    await page.evaluate((mid) => {
      const slider = document.querySelector('input[type="range"]');
      slider.value = mid;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }, sliderInfo.mid);

    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, `${dateLabel}-05-slider-midpoint.png`), fullPage: true });
    console.log(`Screenshot saved: ${dateLabel}-05-slider-midpoint.png`);

    const afterSlide = await page.evaluate(() => {
      const waypointInfo = document.querySelector('.waypoint-info');
      const planeMarker = document.querySelector('.plane-marker');
      return {
        waypointInfoText: waypointInfo ? waypointInfo.innerText : 'NOT FOUND',
        planeMarkerExists: !!planeMarker
      };
    });
    console.log('After slider move:', afterSlide);
  } else {
    console.log('Slider not found!');
  }

  // STEP 7: Report console errors
  console.log(`\nSTEP 7: Console errors captured:`);
  if (consoleErrors.length === 0) {
    console.log('No console errors');
  } else {
    consoleErrors.forEach(err => console.log('  ERROR:', err));
  }

  await browser.close();

  return {
    dateLabel,
    formVisible: formFields.labels.length > 0,
    cardHasSide: hasLeft || hasRight,
    cardHasConfidence: hasHigh || hasLow || hasMedium,
    cardHasFlightInfo: hasFlightInfo,
    mapContainerExists: mapInfo.mapContainerExists,
    mapContainerVisible: mapInfo.mapContainerVisible,
    tileCount: mapInfo.tileCount,
    pathExists: mapInfo.pathExists,
    markerCount: mapInfo.markerCount,
    sliderFound: sliderInfo.found,
    consoleErrors: consoleErrors.length
  };
}

async function main() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]; // +1 day

  // Test A: Today's date + flight number
  console.log('\n===========================================');
  console.log('TEST A: Today + Flight Number (UA2369)');
  console.log('===========================================');
  const resultA = await runTest('today-flight', today, async (page) => {
    // Date should already be set to today
    await page.fill('input[name="flight_number"]', 'UA2369');
  });

  // Test B: Future date + airport autocomplete
  console.log('\n===========================================');
  console.log(`TEST B: Future Date (${tomorrow}) + Airport Autocomplete`);
  console.log('===========================================');
  const resultB = await runTest('future-airports', tomorrow, async (page) => {
    // Set date to tomorrow
    await page.fill('input[name="departure_date"]', tomorrow);

    // Wait for date change to take effect and form to switch to airport mode
    await page.waitForTimeout(500);

    // Fill From autocomplete
    const fromInput = page.locator('input[name="from_airport"]');
    await fromInput.fill('new york');
    await page.waitForTimeout(1000); // Wait for debounced search

    // Click first suggestion
    await page.click('.autocomplete-dropdown li:has-text("JFK")');

    // Fill To autocomplete
    const toInput = page.locator('input[name="to_airport"]');
    await toInput.fill('los angeles');
    await page.waitForTimeout(1000); // Wait for debounced search

    // Click first suggestion
    await page.click('.autocomplete-dropdown li:has-text("LAX")');

    // Fill departure time
    await page.fill('input[name="departure_time"]', '14:00');
  });

  // Summary
  console.log('\n========== FINAL SUMMARY ==========');
  console.log(`TEST A (Today + Flight):`);
  console.log(`  Form visible: ${resultA.formVisible}`);
  console.log(`  Card has side: ${resultA.cardHasSide}`);
  console.log(`  Card has confidence: ${resultA.cardHasConfidence}`);
  console.log(`  Card has flight_info: ${resultA.cardHasFlightInfo}`);
  console.log(`  Map works: ${resultA.mapContainerExists && resultA.mapContainerVisible && resultA.pathExists}`);
  console.log(`  Slider works: ${resultA.sliderFound}`);
  console.log(`  Console errors: ${resultA.consoleErrors}`);

  console.log(`\nTEST B (Future + Airports):`);
  console.log(`  Form visible: ${resultB.formVisible}`);
  console.log(`  Card has side: ${resultB.cardHasSide}`);
  console.log(`  Card has confidence: ${resultB.cardHasConfidence}`);
  console.log(`  Card has flight_info: ${resultB.cardHasFlightInfo}`);
  console.log(`  Map works: ${resultB.mapContainerExists && resultB.mapContainerVisible && resultB.pathExists}`);
  console.log(`  Slider works: ${resultB.sliderFound}`);
  console.log(`  Console errors: ${resultB.consoleErrors}`);

  const allPassed = resultA.formVisible && resultA.cardHasSide && resultA.cardHasConfidence &&
                     resultA.mapContainerExists && resultA.mapContainerVisible && resultA.pathExists && resultA.sliderFound && resultA.consoleErrors === 0 &&
                     resultB.formVisible && resultB.cardHasSide && resultB.cardHasConfidence &&
                     resultB.mapContainerExists && resultB.mapContainerVisible && resultB.pathExists && resultB.sliderFound && resultB.consoleErrors === 0;

  console.log(`\n=== ALL TESTS ${allPassed ? 'PASSED' : 'FAILED'} ===`);
}

main().catch(console.error);