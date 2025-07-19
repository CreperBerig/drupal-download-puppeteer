import puppeteer, { Page } from 'puppeteer';
import { checkbox, select } from '@inquirer/prompts';

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

//Function to enter a database connection
async function dbConnection(page: Page, params: {lang: string, profile: string}) {
    await page.goto(`http://localhost:8080/core/install.php?langcode=${params.lang}&profile=${params.profile}&continue=1`, {waitUntil: 'load'});
    const dbTypes = await page.evaluate(() => 
        Array.from(document.querySelectorAll('.js-form-type-radio'))
            .map(item => {
                return {
                    value: item.querySelector('input[type="radio"]')?.getAttribute('value'),
                    name: item.querySelector('label')?.textContent?.trim(),
                }
            })
    )

    if (dbTypes.length === 0) {
        throw new Error('No database types found. Please ensure the database drivers are installed.');
    } else if (dbTypes.length === 1) {
        console.log(`Only one database type found: ${dbTypes[0].name}. Automatically selecting it.`);
    } else {
        const dbType = await select({
            message: 'Select a database type',
            choices: dbTypes,
        })
        await page.click(`input[value="${dbType}"]`);
    }

    await page.click(`summary[class="claro-details__summary"]`);

    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-database"]`, enterDBparams('Enter the database name: '));
    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-username"]`, enterDBparams('Enter the database user: '));
    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-password""]`, enterDBparams('Enter the database password: '));

    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-host"]`, prompt('Enter the database host (default: localhost): ') || 'localhost');
    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-port"]`, prompt('Enter the database port (default: 5432): ') || '5432');
    let DB_prefix = prompt('Enter the database table prefix (not requierd): ');
    if( DB_prefix) await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-prefix"]`, DB_prefix);
}

function enterDBparams(message: string) {
    while (true) {
        const answer = prompt(message);
        if (answer) return answer;
        console.error('Input cannot be empty. Please try again.');
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