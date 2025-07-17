import puppeteer, { Page } from 'puppeteer';
import { checkbox } from '@inquirer/prompts';

async function press(page: Page, key: string) {
    await page.waitForSelector(key);
    await page.click(key);
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false
    });
    const page = await browser.newPage();
    await page.goto('http://localhost:8080/', {waitUntil: 'domcontentloaded'});
    if (await page.$('a[href="/core/install.php?continue=1"]')) {
        await press(page, 'a[href="/core/install.php?continue=1"]');
    }

    await page.waitForSelector(`label[class="form-item__label option"]`)
    const labels = await page.evaluate(() => 
        Array.from(document.querySelectorAll('.form-item__label'))
            .map(el => el.textContent?.trim())
    );
    const checkboxLabels = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.form-checkbox'))
            .map(el => el.dataset.drupalSelector)
    );
    console.log(labels);
    console.log(checkboxLabels);

    const selections = await checkbox({
        message: 'You can select pre-configured types of content now (you can add them later)',
        choices: labels.map((label, index) => 
            ({value: index, name: label})
        ),
        pageSize: labels.length,
    });

    if( selections.length > 0 ) {
        for (const index of selections) {
            console.log(`Selecting checkbox for:\t${labels[index]}\t${checkboxLabels[index]}`);
            const selector = `input[data-drupal-selector="${checkboxLabels[index]}"]`;
            await page.evaluate(selector => {
                const el = document.querySelector(selector) as HTMLInputElement | null;
                if (el) el.click();
            }, `input[data-drupal-selector="${checkboxLabels[index]}"]`);
        }
        //await press(page, `input[data-drupal-selector="edit-submit"]`);
    } else {
        console.log('skipping...');
        //await press(page, `input[data-drupal-selector="edit-skip"]`);
    }
})();