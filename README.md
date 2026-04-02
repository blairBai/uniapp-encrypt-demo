# uniapp-encrypt-demo

一个基于 `uni-app + Vue 3` 的移动端加密验证示例，用于在 `Android / iOS` 真机环境下测试音频、视频文件的原地加密与解密是否可用。

项目重点不是业务界面，而是验证以下能力是否在 `APP-PLUS` 环境中稳定可用：

- 录音、拍摄视频并落盘到本地文件系统
- 通过 `plus.io`、`plus.android`、`plus.ios` 访问原生文件能力
- 对本地媒体文件执行原地读写
- 在加密后确认媒体不可正常播放，在解密后恢复正常

## 项目说明

应用首页提供两个测试入口：

- 音频测试页：录制音频后，对整个文件内容执行 XOR 加密 / 解密
- 视频测试页：拍摄视频后，仅对文件头部执行 XOR 加密 / 解密

当前页面结构如下：

```text
pages/
├── index/index.vue            # 首页，测试入口
└── record/
    ├── home-record.vue        # 音频测试页
    ├── record.vue             # 视频测试页
    └── encrypt.js             # 加密/解密核心逻辑
```

## 加密策略

核心实现位于 [pages/record/encrypt.js](/Users/byf/Documents/HBuilderProjects/uniapp-encrypt-demo/pages/record/encrypt.js)。

### 统一规则

- 使用固定异或密钥：`0xAB`
- 加密和解密使用同一套逻辑，再执行一次即可还原
- 采用原地写回，不生成新的副本文件

### 音频文件

- 方法：`encryptAudio(filePath)` / `decryptAudio(filePath)`
- 策略：对整个文件内容做 XOR
- 处理方式：分块读写，默认单次处理 `512KB`
- 目的：验证大文件在移动端原生环境下的稳定读写能力

### 视频文件

- 方法：`encryptVideo(filePath)` / `decryptVideo(filePath)`
- 策略：仅处理前 `1024` 字节文件头
- 目的：快速验证“视频头损坏后无法正常解码，恢复后可正常播放”的效果

### 平台差异

- Android：通过 `plus.android.importClass('java.io.RandomAccessFile')` 执行随机写入
- iOS：通过 `NSFileHandle` + `NSData` 执行指定偏移量读写

## 运行环境

这个项目主要用于真机验证，不能把 H5 当成目标运行环境。

要求如下：

- `HBuilderX`
- `uni-app`
- Android 或 iOS 真机
- 允许应用获取麦克风、相机、存储相关权限

不建议用以下环境验证结果：

- 浏览器 H5
- 仅模拟器、不上真机
- 小程序环境

原因是项目依赖 `plus.*` 原生 API，只有在 `APP-PLUS` 环境下才完整可用。

## 运行方式

1. 用 `HBuilderX` 打开本项目。
2. 选择“运行到手机或模拟器”。
3. 优先在 Android、iOS 真机各跑一轮。
4. 首次启动时授予录音、相机、文件访问权限。

如果你要重点验证原生文件读写，建议直接运行到自定义基座或云打包后的 App。

## 使用流程

### 音频验证

1. 进入“音频测试页”。
2. 点击“开始录音”，录制 3 到 10 秒。
3. 点击“停止录音”，确认页面已生成音频文件路径。
4. 点击“播放原文件”，确认原始音频可正常播放。
5. 点击“执行加密”。
6. 再次播放，若播放器无法识别或播放异常，说明加密已生效。
7. 点击“执行解密”。
8. 再次播放，若恢复正常，说明往返处理成功。

### 视频验证

1. 进入“视频测试页”。
2. 点击“拍摄视频”，录制一段短视频。
3. 确认视频可正常预览和播放。
4. 点击“执行加密”。
5. 再次播放，若无法正常解码或预览异常，说明头部加密已生效。
6. 点击“执行解密”。
7. 再次播放，若恢复正常，说明头部恢复成功。

## 权限说明

项目当前在 [manifest.json](/Users/byf/Documents/HBuilderProjects/uniapp-encrypt-demo/manifest.json) 中已声明部分 Android 权限，测试时至少需要关注：

- 相机权限
- 麦克风权限
- 文件读写相关权限

如果真机上出现以下现象，优先排查权限问题：

- 无法开始录音
- 无法拍摄视频
- 文件路径生成成功但读写失败
- 加密或解密时报原生 IO 异常

## 关键实现说明

### 音频页面

文件 [pages/record/home-record.vue](/Users/byf/Documents/HBuilderProjects/uniapp-encrypt-demo/pages/record/home-record.vue) 提供：

- 原生录音
- 文件路径展示
- 原文件播放
- 音频加密 / 解密
- 操作日志回显

其中录音文件默认写入：

```text
_doc/audio/
```

### 视频页面

文件 [pages/record/record.vue](/Users/byf/Documents/HBuilderProjects/uniapp-encrypt-demo/pages/record/record.vue) 提供：

- 调起相机拍摄视频
- 将临时文件移动到应用私有目录
- 视频预览
- 视频头部加密 / 解密
- 操作日志回显

视频文件会尽量移动到：

```text
_doc/video/
```

## 常见问题

### 1. 为什么 H5 里不能测试？

因为当前实现直接依赖：

- `plus.io`
- `plus.audio`
- `plus.android`
- `plus.ios`

这些都属于 `uni-app` 的原生运行时能力，不是浏览器标准 API。

### 2. 为什么视频只加密头部，不全量加密？

这个项目的目标是验证“文件头被破坏后媒体是否失效，以及恢复后是否可正常播放”。  
只处理前 `1KB` 更快，也更容易观察效果。

### 3. 为什么音频做全量加密？

音频文件通常更适合做完整内容验证，可以顺便测试分块读写在移动端的稳定性。

### 4. 为什么加密后文件还在原路径？

因为当前实现是原地修改文件内容，不会额外复制出一份加密文件。

## 注意事项

- 当前加密方式是演示用途的 XOR，不适合真实生产安全场景。
- 同一个文件重复执行一次加密，效果等同于解密，请避免误操作导致状态混淆。
- 视频仅加密头部，不代表文件其余内容已受保护。
- iOS、Android 原生文件 API 行为不同，建议分别真机验证。
- 如果你后续要接入正式加密方案，建议把“演示 XOR”替换为真正的分段加密或流式加密实现。

## 后续可扩展方向

- 增加“复制后再加密”，避免直接修改原始文件
- 增加文件哈希校验，确认解密后内容是否完全还原
- 增加批量文件测试
- 抽离统一的媒体文件处理服务层
- 替换为 AES 等正式加密方案

## 截图
<img width="440" height="890" alt="iShot Pro 2026-04-02 14 23 45" src="https://github.com/user-attachments/assets/809e7ff4-f3b6-4041-8a35-bad2b1dfbf04" />

<img width="440" height="890" alt="iShot Pro 2026-04-02 14 29 31" src="https://github.com/user-attachments/assets/2ba8eda2-5a42-4829-9cdb-a5262db89c09" />

<img width="440" height="890" alt="iShot Pro 2026-04-02 14 30 04" src="https://github.com/user-attachments/assets/da098d9d-3e37-4901-8ad3-811c6e8ff205" />
