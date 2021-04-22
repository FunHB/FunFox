import puppeteer, { Browser, Page } from 'puppeteer'
import fetch from 'node-fetch'
import { JSDOM } from 'jsdom'
import fs from 'fs-extra'
import path from 'path'

export class Scraper {
    public static defaultSavePath = path.join(process.cwd(), 'manga')

    public startChapter = 0
    public chaptersCount = 0
    public chaptersQuantity = 0
    public chapter: number
    public pageNumber = 1
    public pagesQuantity = 0
    public lastPage = false
    public savePath: string

    private static browser: Browser
    private static page: Page

    private baseUrl = 'http://fanfox.net'
    private mangaName: string
    private chapterUrl: string

    constructor(mangaName: string, startChapter: number, savePath: string) {
        this.mangaName = mangaName
        this.startChapter = startChapter
        this.chapter = startChapter
        this.chapterUrl = this.getChapterUrl()
        this.savePath = savePath.length > 0 ? savePath : Scraper.defaultSavePath
    }

    public async download(): Promise<void> {
        const imageUrl = await this.getImageUrl()
        if (!imageUrl) return

        const url = imageUrl.split('?').shift()
        const imageName = url?.split('/').pop()
        const chapter = this.chapter

        if (!chapter) return

        const dirpath = path.join(this.savePath, this.mangaName, chapter.toString())
        const filepath = path.join(dirpath, imageName!)

        if (fs.existsSync(filepath)) {
            console.info(`Image ${filepath} exist. Skipping`)
            return
        }

        console.info('[Download] Downloading image')
        const response = await fetch(imageUrl)
        console.info('[Download] saving image')
        await fs.ensureDir(dirpath)
        await fs.writeFile(filepath, await response.buffer())
        console.info(`[Download] Saved to ${filepath}`)
    }

    public static async startBrowser(): Promise<void> {
        console.info('[Web scraper] Starting new browser')
        this.browser = await puppeteer.launch({
            product: 'chrome',
            headless: true
        })

        console.info('[Web scraper] Starting new page')
        this.page = await this.browser.newPage()
    }

    public static async closeBrowser(): Promise<void> {
        console.info('[Web scraper] Closing browser')
        await this.browser.close()
    }

    public static async getHTMLDom(url: string, cookie?: { name: string, value: string }): Promise<Document | null> {
        try {
            console.info(`[Web scraper] Loading site ${url}`)
            await this.page.goto(url, {
                waitUntil: 'networkidle0',
                timeout: 45000
            })
        } catch (exception) {
            console.error(`[Web scraper] ${exception}`)

            await Scraper.closeBrowser()
            await Scraper.startBrowser()

            console.info(`[Web scraper] Loading site ${url}`)
            await this.page.goto(url, {
                waitUntil: 'networkidle0',
                timeout: 45000
            })
        }

        if (cookie) await this.setCookie(cookie)

        return new JSDOM(await this.page.content()).window.document
    }

    public static async setCookie(cookie: { name: string, value: string }): Promise<void> {
        console.info(`[Web scraper] Loading specified cookie`)

        if (!((await this.page.cookies()).find(_cookie => _cookie.name === cookie.name && _cookie.value === cookie.value))) {
            console.info(`[Web scraper] Setting Cookie ${cookie.name} with value ${cookie.value}`)
            await this.page.setCookie(cookie)

            console.info('[Web scraper] Reloading site')
            await this.page.reload()
            return
        }

        console.info('[Web scraper] Cookie already exist. Skiping')
    }

    public async setChaptersQuantity(): Promise<void> {
        const url = path.join(this.baseUrl, 'manga', this.mangaName)
        console.info(`[Chapters Quantity] Getting chapters quantity from ${url}`)
        const document = await Scraper.getHTMLDom(url, { name: 'isAdult', value: '1' })
        if (!document) return
        const chapters = Math.max(...Array.from(document.querySelectorAll('.detail-main-list-main')).map(element => element.textContent?.match(/Ch.(\d){3}/m)).map(array => array ? parseFloat(array[0].substring(3)) : 0))
        console.info(`[Chapters Quantity] Chapters quantity is ${chapters}`)
        this.chaptersQuantity = chapters
    }

    public async setPagesQuantity(): Promise<void> {
        console.info(`[Pages Quantity] Getting pages quantity from ${this.chapterUrl}`)
        const document = await Scraper.getHTMLDom(this.chapterUrl, { name: 'isAdult', value: '1' })
        if (!document) return
        const pages = Math.max(...Array.from(document.querySelectorAll('.pager-list-left a')).map(element => !isNaN(parseInt(`${element.textContent}`)) ? parseInt(`${element.textContent}`) : 0))
        console.info(`[Pages Quantity] Pages quantity is ${pages}`)
        this.pagesQuantity = pages
    }

    public lastChapter(): boolean {
        return this.chaptersQuantity === this.chapter
    }

    private async getImageUrl(): Promise<string | null> {
        console.info(`[Image Url] Getting image url from ${this.chapterUrl}`)
        const document = await Scraper.getHTMLDom(this.chapterUrl, { name: 'isAdult', value: '1' })
        const imageUrl = document?.querySelector('.reader-main-img')?.getAttribute('src')

        if (!imageUrl) return null
        const url = imageUrl.startsWith('//') ? `http:${imageUrl}` : imageUrl
        console.info(`[Image Url] image url is ${url}`)

        console.info(`[Last Page] checking if this is the last page (${this.chapterUrl})`)
        this.lastPage = document?.querySelector('.pager-list-left a.active')?.textContent === this.pagesQuantity.toString()
        console.info(`[Last Page] ${this.lastPage ? 'This is last page' : 'This is not last page'}`)

        return url
    }

    public async nextChapter(): Promise<void> {
        this.pageNumber = 1

        console.info(`[Next Chapter] Getting next chapter from ${this.chapterUrl}`)
        const document = await Scraper.getHTMLDom(this.chapterUrl, { name: 'isAdult', value: '1' })
        if (!document) return

        const nextChapter = document.querySelector('.reader-main-next')?.getAttribute('href')
        if (!nextChapter) return

        console.info(`[Next Chapter] Next chapter url is ${nextChapter}`)
        this.chapterUrl = path.join(this.baseUrl, nextChapter)
        this.chapter = this.getChapterNumber()
    }

    private getChapterNumber(): number {
        const chapter = this.chapterUrl.match(/c(\d){3}/m)?.shift()
        if (!chapter) return 0
        return parseFloat(chapter.substring(1))
    }

    private getChapterUrl(): string {
        const chapter = this.chapter.toString()
        const url = path.join(this.baseUrl, 'manga', this.mangaName, 'c' + ('000' + chapter.split('.').shift()).slice(-3))
        if (chapter.includes('.')) return `url${'.' + chapter.split('.').pop()}`
        return url
    }

    public async mangaExists(): Promise<boolean> {
        if (this.mangaName.length < 1) return false
        const url = `${this.baseUrl}/manga/${this.mangaName}/`
        console.info(`[Manga Check] Checking if the manga ${url} exists`)
        const result = url == (await fetch(url)).url
        console.info(`[Manga Check] Manga status: ${result ? 'Exist' : 'Not found'}`)
        return result
    }

    public nextPage(): void {
        const tmp = this.chapterUrl.split(/[\/\\]/gm)
        const page = tmp.pop()

        if (page?.endsWith('.html')) {
            this.chapterUrl = path.join(tmp.join('\\'), `${++this.pageNumber}.html`)
            return
        }
        this.chapterUrl = path.join(this.chapterUrl, `${++this.pageNumber}.html`)
    }
}