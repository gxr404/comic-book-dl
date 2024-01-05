import { readFileSync } from 'node:fs'
import { cac } from 'cac'
import { main } from './index'
import { logger } from './utils'
import { update } from './update'

const cli = cac('comic-book-dl')

export interface IOptions {
  distPath: string;
}

// 不能直接使用 import {version} from '../package.json'
// 否则declaration 生成的d.ts 会多一层src目录
const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url)).toString(),
)

cli.command('update', '更新已下载的漫画')
  .option('-d, --distPath <dir>', '下载的目录 eg: -d comic-book', {
    default: 'comic-book',
  })
  .action(async (options: IOptions) => {
    try {
      await update({
        bookPath: options.distPath
      })
    } catch (err) {
      console.log(err)
      logger.error(err.message || 'unknown exception')
    }
  })

cli
  .command('<url>', '包子漫画-漫画目录页url')
  .option('-d, --distPath <dir>', '下载的目录 eg: -d comic-book', {
    default: 'comic-book',
  })
  .action(async (url, options: IOptions) => {
    try {
      await main({
        targetUrl: url,
        bookPath: options.distPath
      })
    } catch (err) {
      console.log(err)
      logger.error(err.message || 'unknown exception')
    }
  })

cli.help()
cli.version(version)

try {
  cli.parse()
} catch (err) {
  logger.error(err.message || 'unknown exception')
  process.exit(1)
}
