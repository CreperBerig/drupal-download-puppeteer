import puppeteer, { Page } from 'puppeteer';
import { input, select } from '@inquirer/prompts';
import { dbConnection } from './DB_Connection';

const LOAD_DELAY = 1000; // ms

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
        await Promise.all([
            press(page, `input[data-drupal-selector="edit-submit"]`),
            page.waitForNavigation()
        ]);
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

    await Promise.all([
        press(page, `input[data-drupal-selector="edit-submit"]`),
        page.waitForNavigation({waitUntil: 'load'})
    ]);
    if(await page.$(`div.claro-details__wrapper`)) {
        console.warn(`PHP OPcode caching can improve your site's performance considerably. It is highly recommended to have OPcache installed on your server. Site OPcache: http://php.net/manual/opcache.installation.php`);
        return choseArray[answer[1]];
    }
}

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    try {
        await page.goto('http://localhost:8080/', {waitUntil: 'load'});
    } catch (error) {
        for(let i = 0; i < 3; i++) {
            console.error(`Error loading page: ${error.message}. Retrying... (${i + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, LOAD_DELAY));
            try {
                await page.goto('http://localhost:8080/', {waitUntil: 'load'});
                break;
            } catch (err) {
                if (i === 2) {
                    console.error('Failed to load the page after 3 attempts. Exiting...');
                    await browser.close();
                    return;
                }
            }
        }
    }
    if(!await page.$(`a[class="visually-hidden focusable skip-link"]`)) {
        console.log(`Drupal is already installed. You can access your site at http://localhost:8080/ \n`);
        await browser.close();
        return;
    }

    page.waitForSelector(`select[data-drupal-selector="edit-langcode"]`);
    let lang = await langChosen(page);
    let profile = await profileChosen(page, {lang});

    let isDBConnected = false;
    while (!isDBConnected) {
        try{
            await dbConnection(page, {lang, profile, browser});
        } catch (error) {
            console.error('Error during database connection setup:', error);
            await browser.close();
            return;
        }
        if(await page.$(`div[class="messages-list__item messages messages--error"]`)) {
            console.error('There was an error during the database connection setup. Please check your inputs and try again.');
        } else {
            isDBConnected = true;
        }
    }

    if(await page.$(`ul`)){
        console.log(`\nDrupal installation is already. You can access your site at http://localhost:8080/`);
        await browser.close();
        return;
    }

    let isDownload = false;
    console.log(`\nWaiting for installation to complete...`);
    while (!isDownload) {
        await new Promise(resolve => setTimeout(resolve, LOAD_DELAY));
        if( await page.$(`span[class="fieldset__label fieldset__label--group"]`)) isDownload = true;
    }
    console.log('Installation completed successfully!');

    console.log(`\nConfigure site`);
    console.log(`\tSite information`);
    await page.type(`input[id="edit-site-name"]`, await input({message: 'Site name:', required: true}));
    await page.type(`input[id="edit-site-mail"]`, await input({message: 'Site/Account email address:', required: true}));
    console.log(`\tSite maintenance account`);

    let username;
    let isValid = false;
    while (!isValid) {
        username = await input({message: 'Enter the username for the maintenance account:', required: true});
        const regex = /^[a-zA-Z0-9 .'\-_@]+$/;
        isValid = regex.test(username) && username.length >= 6;
        if (!isValid) {
            console.error(`Several special characters are allowed, including space, period (.), hyphen (-), apostrophe ('), underscore (_), and the @ sign.`);
        }
    }
    await page.type(`input[id="edit-account-name"]`, username);
    await page.type(`input[id="edit-account-pass-pass1"]`, await input({message: 'Password:', required: true}));
    await page.type(`input[id="edit-account-pass-pass2"]`, await input({message: 'Confirm password:', required: true}));

    await Promise.all([
        page.click(`input[data-drupal-selector="edit-submit"]`),
        page.waitForNavigation({waitUntil: 'load'})
    ]);

    console.log(`\nDrupal installation is complete! You can access your site at http://localhost:8080/`);
    await browser.close();
})();