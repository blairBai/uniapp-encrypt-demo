<template>
	<scroll-view scroll-y class="page">
		<view class="hero">
			<text class="eyebrow">Video Scenario</text>
			<text class="title">视频加密测试</text>
			<text class="desc">拍摄一段短视频后，执行视频头部加密与解密，用于验证移动端文件访问和原生写入逻辑是否正常。</text>
		</view>

		<view class="preview-card">
			<video v-if="videoPath" class="video-player" :src="videoPath" controls></video>
			<view v-else class="placeholder">
				<text class="placeholder-title">暂无视频文件</text>
				<text class="placeholder-desc">点击下方按钮拍摄 5 到 15 秒视频，便于观察加密前后差异。</text>
			</view>
		</view>

		<view class="panel">
			<text class="panel-title">当前状态</text>
			<text class="status-line">运行环境：{{ platformText }}</text>
			<text class="status-line">文件状态：{{ fileStateText }}</text>
			<text class="status-line path" selectable>文件路径：{{ videoPath || '暂无' }}</text>
		</view>

		<view class="action-grid">
			<button class="action primary" :disabled="!appReady || busy" @click="captureVideo">拍摄视频</button>
			<button class="action" :disabled="!videoPath || busy || encrypted" @click="encryptCurrentVideo">执行加密</button>
			<button class="action" :disabled="!videoPath || busy || !encrypted" @click="decryptCurrentVideo">执行解密</button>
			<button class="action ghost" :disabled="busy" @click="goToAudioPage">前往音频测试</button>
		</view>

		<view class="panel">
			<text class="panel-title">测试建议</text>
			<text class="hint">1. 拍摄完成后先确认视频可以正常播放。</text>
			<text class="hint">2. 执行加密后再次播放，若视频无法正常解码或预览异常，说明头部加密已生效。</text>
			<text class="hint">3. 执行解密后重新播放，若恢复正常，说明头部往返处理可用。</text>
		</view>

		<view class="log-panel">
			<text class="panel-title">操作日志</text>
			<view v-if="logs.length" class="log-list">
				<text v-for="(item, index) in logs" :key="index" class="log-item">{{ item }}</text>
			</view>
			<text v-else class="empty-log">暂无日志</text>
		</view>
	</scroll-view>
</template>

<script setup>
	import {
		computed,
		ref
	} from 'vue';
	import {
		decryptVideo,
		encryptVideo
	} from './encrypt.js';

	const appReady = ref(typeof plus !== 'undefined');
	const busy = ref(false);
	const encrypted = ref(false);
	const videoPath = ref('');
	const logs = ref([]);

	const platformText = computed(() => {
		if (!appReady.value) {
			return '请在 APP-PLUS 环境运行';
		}
		return plus.os?.name || '未知平台';
	});

	const fileStateText = computed(() => {
		if (!videoPath.value) {
			return '未生成文件';
		}
		return encrypted.value ? '已加密' : '未加密';
	});

	const pushLog = (message) => {
		logs.value.unshift(`${new Date().toLocaleTimeString()} ${message}`);
	};

	const ensureApp = () => {
		if (typeof plus === 'undefined') {
			appReady.value = false;
			uni.showToast({
				title: '请在 Android/iOS App 中测试',
				icon: 'none'
			});
			return false;
		}
		appReady.value = true;
		return true;
	};

	const moveToPrivateDir = (tempFilePath) => {
		return new Promise((resolve) => {
			if (typeof plus === 'undefined') {
				resolve(tempFilePath);
				return;
			}
			const fileName = `video_${Date.now()}.mp4`;
			plus.io.resolveLocalFileSystemURL(tempFilePath, (entry) => {
				plus.io.resolveLocalFileSystemURL('_doc/', (docEntry) => {
					docEntry.getDirectory('video', {
						create: true
					}, (dirEntry) => {
						entry.moveTo(dirEntry, fileName, (newEntry) => {
							resolve(newEntry.toLocalURL());
						}, () => resolve(tempFilePath));
					}, () => resolve(tempFilePath));
				}, () => resolve(tempFilePath));
			}, () => resolve(tempFilePath));
		});
	};

	const captureVideo = () => {
		if (!ensureApp() || busy.value) {
			return;
		}
		uni.chooseVideo({
			sourceType: ['camera'],
			maxDuration: 20,
			camera: 'back',
			success: async (res) => {
				const finalPath = await moveToPrivateDir(res.tempFilePath);
				videoPath.value = finalPath;
				encrypted.value = false;
				pushLog(`视频拍摄完成，文件已保存到 ${finalPath}`);
			},
			fail: (error) => {
				if (error.errMsg && error.errMsg.indexOf('cancel') > -1) {
					pushLog('用户取消了视频拍摄');
					return;
				}
				pushLog(`视频拍摄失败：${error.errMsg || '未知错误'}`);
				uni.showToast({
					title: '拍摄失败',
					icon: 'none'
				});
			}
		});
	};

	const runTransform = async (type) => {
		if (!ensureApp() || !videoPath.value || busy.value) {
			return;
		}
		busy.value = true;
		uni.showLoading({
			title: type === 'encrypt' ? '加密中...' : '解密中...',
			mask: true
		});
		try {
			if (type === 'encrypt') {
				await encryptVideo(videoPath.value);
				encrypted.value = true;
				pushLog('视频头部加密完成');
			} else {
				await decryptVideo(videoPath.value);
				encrypted.value = false;
				pushLog('视频头部解密完成');
			}
			uni.showToast({
				title: type === 'encrypt' ? '加密完成' : '解密完成',
				icon: 'success'
			});
		} catch (error) {
			pushLog(`${type === 'encrypt' ? '加密' : '解密'}失败：${error.message || error}`);
			uni.showToast({
				title: type === 'encrypt' ? '加密失败' : '解密失败',
				icon: 'none'
			});
		} finally {
			busy.value = false;
			uni.hideLoading();
		}
	};

	const encryptCurrentVideo = () => runTransform('encrypt');
	const decryptCurrentVideo = () => runTransform('decrypt');

	const goToAudioPage = () => {
		uni.navigateTo({
			url: '/pages/record/home-record'
		});
	};
</script>

<style>
	.page {
		min-height: 100vh;
		padding: 28rpx 28rpx 40rpx;
		box-sizing: border-box;
		background:
			radial-gradient(circle at top left, rgba(59, 130, 246, 0.22), transparent 34%),
			linear-gradient(180deg, #f7fbff 0%, #eefcf7 100%);
	}

	.hero {
		padding: 16rpx 8rpx 28rpx;
	}

	.eyebrow {
		display: block;
		font-size: 22rpx;
		letter-spacing: 4rpx;
		color: #1d4ed8;
		margin-bottom: 16rpx;
	}

	.title {
		display: block;
		font-size: 52rpx;
		font-weight: 700;
		line-height: 1.18;
		color: #1f2933;
	}

	.desc {
		display: block;
		margin-top: 18rpx;
		font-size: 28rpx;
		line-height: 1.8;
		color: #52606d;
	}

	.preview-card,
	.panel,
	.log-panel {
		margin-top: 24rpx;
		padding: 26rpx;
		border-radius: 24rpx;
		background: rgba(255, 255, 255, 0.82);
		box-shadow: 0 18rpx 36rpx rgba(15, 23, 42, 0.06);
	}

	.video-player,
	.placeholder {
		width: 100%;
		height: 420rpx;
		border-radius: 20rpx;
		overflow: hidden;
		background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%);
	}

	.placeholder {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 32rpx;
		box-sizing: border-box;
	}

	.placeholder-title {
		display: block;
		font-size: 34rpx;
		font-weight: 600;
		color: #1e3a8a;
	}

	.placeholder-desc {
		display: block;
		margin-top: 14rpx;
		font-size: 26rpx;
		line-height: 1.8;
		text-align: center;
		color: #486581;
	}

	.panel-title {
		display: block;
		font-size: 32rpx;
		font-weight: 600;
		color: #243b53;
		margin-bottom: 16rpx;
	}

	.status-line,
	.hint,
	.empty-log,
	.log-item {
		display: block;
		font-size: 26rpx;
		line-height: 1.8;
		color: #486581;
	}

	.path {
		word-break: break-all;
	}

	.action-grid {
		margin-top: 24rpx;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 20rpx;
	}

	.action {
		height: 88rpx;
		line-height: 88rpx;
		border-radius: 999rpx;
		font-size: 28rpx;
		color: #0f172a;
		background: #ffffff;
		border: 2rpx solid rgba(15, 23, 42, 0.08);
	}

	.action::after {
		border: none;
	}

	.action.primary {
		background: #1d4ed8;
		color: #ffffff;
	}

	.action.ghost {
		background: #dcfce7;
		color: #166534;
	}

	.log-list {
		display: flex;
		flex-direction: column;
		gap: 8rpx;
	}
</style>
