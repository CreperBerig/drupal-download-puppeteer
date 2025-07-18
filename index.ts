import puppeteer, { Page } from 'puppeteer';
import { checkbox, select } from '@inquirer/prompts';

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
    page.waitForSelector(`select[data-drupal-selector="edit-langcode"]`);
    let lang = true;
    while(lang) {
        const answer = await select({
            message: 'Select language',
            choices: (await page.evaluate(() => {
                return Array.from(document.querySelectorAll('select[data-drupal-selector="edit-langcode"] option')).map(item=> ({
                    name: item.textContent?.trim(),
                    value: item.value
                }))
            })),
            default: 'en'
        });
        await page.select(`select[data-drupal-selector="edit-langcode"]`, answer);
        await press(page, `input[data-drupal-selector="edit-submit"]`);
        if(await page.$(`a[href="/core/install.php?langcode=${answer}"]`)){
            console.error('The installer requires to contact the translation server to download a translation file. Check your internet connection and verify that your website can reach the translation server at https://ftp.drupal.org.');
            await page.goBack();
        } else {
            lang = false;
        }
    }

    await page.waitForSelector(`div.js-form-type-radio`);
    const answer = await select({
        message: 'Select an installation profile',
        choices: (await page.evaluate(() => 
        Array.from(document.querySelectorAll('.js-form-type-radio'))
        .map(item => {
            return {
                value: item.querySelector('input[type="radio"]')?.getAttribute('value'),
                name: item.querySelector('label')?.textContent?.trim(),
                description: item.querySelector('div.form-item__description')?.textContent?.trim() || ''
            }
        })))
    });
    await page.click(`input[value="${answer}"]`);
    await press(page, `input[data-drupal-selector="edit-submit"]`);

    if(await page.$(`div[class="claro-details__wrapper"]`)) {
        console.warn(`PHP OPcode caching can improve your site's performance considerably. It is highly recommended to have OPcache installed on your server. Site OPcache: http://php.net/manual/opcache.installation.php`);
        alert('Press ^C to stop a prograam, or press Enter to continue');
        await press(page, `a[href="/core/install.php?langcode=en&profile=standard&continue=1"]`)
    }

    console.log('next')
})();