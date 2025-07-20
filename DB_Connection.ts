import { Page, Browser } from 'puppeteer';
import { select, input } from '@inquirer/prompts';

//Function to enter a database connection
export async function dbConnection(page: Page, params: {lang: string, profile: string, browser: Browser}) {
    await page.goto(`http://localhost:8080/core/install.php?langcode=${params.lang}&profile=${params.profile}&continue=1`, {waitUntil: 'load'});
    console.log(`\nConfigure database connection`);
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
        console.error('No database types found. Please ensure the database drivers are installed.');
        await params.browser.close();
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

    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-database"]`, await input({message: 'Enter the database name:', required: true}));
    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-username"]`, await input({message: 'Enter the database user:', required: true}));
    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-password"]`, await input({message: 'Enter the database password:', required: true}));

    await page.$eval(`input[id="edit-drupalpgsqldriverdatabasepgsql-host"]`, (el: HTMLInputElement) => el.value = '');
    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-host"]`, await input({message: 'Enter the database host (default: localhost):', default: 'localhost'}));
    await page.$eval(`input[id="edit-drupalpgsqldriverdatabasepgsql-port"]`, (el: HTMLInputElement) => el.value = '');
    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-port"]`, await input({message: 'Enter the database port (default: 5432):', default: '5432'}));
    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-prefix"]`, await input({message: 'Enter the database table prefix (not requierd):', default: ''}));

    await Promise.all([
        page.click(`input[data-drupal-selector="edit-save"]`),
        page.waitForNavigation({waitUntil: 'load'})
    ]);
}