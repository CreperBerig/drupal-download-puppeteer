import puppeteer, { Page } from 'puppeteer';
import { select } from '@inquirer/prompts';
import { dbConnection } from './DB_Connection';

const LOAD_DELAY = 2000; // ms

async function press(page: Page, key: string) {
    await page.waitForSelector(key);
    await page.click(key);
}

// Function to handle language selection
async function langChosen(page: Page) {
    while(true) {
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
        await new Promise(resolve => setTimeout(resolve, LOAD_DELAY));
        if(await page.$(`a[href="/core/install.php?langcode=${answer}"]`)){
            console.error('The installer requires to contact the translation server to download a translation file. Check your internet connection and verify that your website can reach the translation server at https://ftp.drupal.org.');
            await page.goBack();
        } else {
            return answer;
        }
    }
}

// Function to select the installation profile
async function profileChosen(page: Page, params: {lang: string}) {
    let choseArray = ['standard', 'minimal', 'demo_umami'];
    await page.goto(`http://localhost:8080/core/install.php?langcode=${params.lang}`, {waitUntil: 'load'});

    const answer = await select({
        message: 'Select an installation profile',
        choices: (await page.evaluate(() => 
        Array.from(document.querySelectorAll('.js-form-type-radio'))
        .map((item, index)=> {
            return {
                value: [item.querySelector('input[type="radio"]')?.getAttribute('value'), index],
                name: item.querySelector('label')?.textContent?.trim(),
                description: item.querySelector('div.form-item__description')?.textContent?.trim() || ''
            }
        })))
    });
    await page.click(`input[value="${answer[0]}"]`);
    await press(page, `input[data-drupal-selector="edit-submit"]`);

    await new Promise(resolve => setTimeout(resolve, 2000));
    if(await page.$(`div.claro-details__wrapper`)) {
        console.warn(`PHP OPcode caching can improve your site's performance considerably. It is highly recommended to have OPcache installed on your server. Site OPcache: http://php.net/manual/opcache.installation.php`);
        return choseArray[answer[1]];
    }
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false
    });
    const page = await browser.newPage();
    await page.goto('http://localhost:8080/', {waitUntil: 'load'});
    page.waitForSelector(`select[data-drupal-selector="edit-langcode"]`);
    let lang = await langChosen(page);
    let profile = await profileChosen(page, {lang});
    console.log(`Selected language: ${lang}`);
    console.log(`Selected profile: ${profile}`);

    await dbConnection(page, {lang, profile});
})();