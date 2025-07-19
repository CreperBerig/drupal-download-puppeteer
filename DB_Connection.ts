import puppeteer, { Page } from 'puppeteer';
import { select } from '@inquirer/prompts';

//Function to enter a database connection
export async function dbConnection(page: Page, params: {lang: string, profile: string}) {
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

    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-database"]`, await enterDBparams('Enter the database name:'));
    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-username"]`, await enterDBparams('Enter the database user:'));
    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-password"]`, await enterDBparams('Enter the database password:'));

    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-host"]`, await prompt('Enter the database host (default: localhost):') || '');
    await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-port"]`, await prompt('Enter the database port (default: 5432):') || '');
    let DB_prefix = await prompt('Enter the database table prefix (not requierd): ');
    if( DB_prefix) await page.type(`input[id="edit-drupalpgsqldriverdatabasepgsql-prefix"]`, DB_prefix);

    await page.click(`input[data-drupal-selector="edit-save"]`);
}

async function enterDBparams(message: string) {
    while (true) {
        let answer = prompt(message);
        console.log(`You entered: ${answer}`);
        if (answer) return answer;
        console.error('Input cannot be empty. Please try again.');
    }
}