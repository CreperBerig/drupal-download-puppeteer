import puppeteer from 'puppeteer';

(async () => {
    try{
        const downloadBtn = `a[class="button button--primary icon-arrow-right"]`
        const browser = await puppeteer.launch({ 
            headless: false
        });
        const page = await browser.newPage();
        await page.goto('https://new.drupal.org/download', {waitUntil: 'domcontentloaded'});
        await page.waitForSelector(downloadBtn)
        await new Promise(resolve => setTimeout(resolve, 3000));
        await page.click(downloadBtn);
        await new Promise(resolve => setTimeout(resolve, 10000));
        await browser.close();
    } catch (error) {
        console.error('Error during download:', error);
    }
})();