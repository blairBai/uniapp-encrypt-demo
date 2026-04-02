<template>
	<scroll-view scroll-y class="page">
		<view class="hero">
			<text class="eyebrow">Audio Scenario</text>
			<text class="title">音频加密测试</text>
			<text class="desc">录制一段音频后，可分别执行加密、解密与重新播放，用于验证 Android、iOS 端文件处理是否正常。</text>
		</view>

		<view class="panel">
			<text class="panel-title">当前状态</text>
			<text class="status-line">运行环境：{{ platformText }}</text>
			<text class="status-line">录音状态：{{ isRecording ? '录制中' : '空闲' }}</text>
			<text class="status-line">文件状态：{{ fileStateText }}</text>
			<text class="status-line">录音时长：{{ durationText }}</text>
			<text class="status-line path" selectable>文件路径：{{ audioPath || '暂无' }}</text>
		</view>

		<view class="action-grid">
			<button class="action primary" :disabled="!appReady || busy || isRecording" @click="startRecord">开始录音</button>
			<button class="action warn" :disabled="!appReady || busy || !isRecording" @click="stopRecord">停止录音</button>
			<button class="action" :disabled="!audioPath || busy || isRecording" @click="playAudio">播放原文件</button>
			<button class="action" :disabled="!audioPath || busy || isRecording || encrypted" @click="encryptCurrentAudio">执行加密</button>
			<button class="action" :disabled="!audioPath || busy || isRecording || !encrypted" @click="decryptCurrentAudio">执行解密</button>
			<button class="action ghost" :disabled="busy" @click="goToVideoPage">前往视频测试</button>
		</view>

		<view class="panel">
			<text class="panel-title">测试建议</text>
			<text class="hint">1. 先录一段 3 到 10 秒音频，确认可以正常播放。</text>
			<text class="hint">2. 点击加密后再次播放，若播放器无法正常识别，说明加密已生效。</text>
			<text class="hint">3. 再点击解密并播放，若恢复正常，说明往返处理可用。</text>
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
		onBeforeUnmount,
		ref
	} from 'vue';
	import {
		decryptAudio,
		encryptAudio
	} from './encrypt.js';

	const appReady = ref(typeof plus !== 'undefined');
	const isRecording = ref(false);
	const busy = ref(false);
	const encrypted = ref(false);
	const audioPath = ref('');
	const durationText = ref('00:00');
	const logs = ref([]);
	let nativeRecorder = null;
	let innerAudioContext = null;
	let timer = null;
	let seconds = 0;

	const platformText = computed(() => {
		if (!appReady.value) {
			return '请在 APP-PLUS 环境运行';
		}
		return plus.os?.name || '未知平台';
	});

	const fileStateText = computed(() => {
		if (!audioPath.value) {
			return '未生成文件';
		}
		return encrypted.value ? '已加密' : '未加密';
	});

	const formatDuration = (value) => {
		const mins = Math.floor(value / 60);
		const secs = value % 60;
		return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	};

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

	const stopTimer = () => {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	};

	const resetPlayer = () => {
		if (innerAudioContext) {
			innerAudioContext.stop();
			innerAudioContext.destroy();
			innerAudioContext = null;
		}
	};

	const startRecord = () => {
		if (!ensureApp() || busy.value) {
			return;
		}
		nativeRecorder = plus.audio.getRecorder();
		if (!nativeRecorder) {
			uni.showToast({
				title: '无法获取录音对象',
				icon: 'none'
			});
			return;
		}

		const ext = plus.os?.name === 'iOS' ? 'wav' : 'aac';
		const fileName = `audio_${Date.now()}.${ext}`;
		seconds = 0;
		durationText.value = '00:00';
		isRecording.value = true;
		resetPlayer();
		pushLog(`开始录音，目标文件 ${fileName}`);

		timer = setInterval(() => {
			seconds += 1;
			durationText.value = formatDuration(seconds);
		}, 1000);

		nativeRecorder.record({
			filename: `_doc/audio/${fileName}`,
			format: ext
		}, (path) => {
			stopTimer();
			isRecording.value = false;
			audioPath.value = path;
			encrypted.value = false;
			pushLog(`录音完成，文件已保存到 ${path}`);
			uni.showToast({
				title: '录音完成',
				icon: 'success'
			});
		}, (error) => {
			stopTimer();
			isRecording.value = false;
			pushLog(`录音失败：${error.message || '未知错误'}`);
			uni.showToast({
				title: '录音失败',
				icon: 'none'
			});
		});
	};

	const stopRecord = () => {
		if (!isRecording.value || !nativeRecorder) {
			return;
		}
		pushLog('请求停止录音');
		nativeRecorder.stop();
	};

	const playAudio = () => {
		if (!audioPath.value || busy.value) {
			return;
		}
		resetPlayer();
		innerAudioContext = uni.createInnerAudioContext();
		innerAudioContext.src = audioPath.value;
		innerAudioContext.onPlay(() => {
			pushLog('开始播放当前音频文件');
		});
		innerAudioContext.onError((error) => {
			pushLog(`播放失败：${error.errMsg || error.message || '未知错误'}`);
			uni.showToast({
				title: '播放失败',
				icon: 'none'
			});
		});
		innerAudioContext.play();
	};

	const runTransform = async (type) => {
		if (!ensureApp() || !audioPath.value || busy.value) {
			return;
		}
		busy.value = true;
		uni.showLoading({
			title: type === 'encrypt' ? '加密中...' : '解密中...',
			mask: true
		});
		try {
			if (type === 'encrypt') {
				await encryptAudio(audioPath.value);
				encrypted.value = true;
				pushLog('音频加密完成');
			} else {
				await decryptAudio(audioPath.value);
				encrypted.value = false;
				pushLog('音频解密完成');
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

	const encryptCurrentAudio = () => runTransform('encrypt');
	const decryptCurrentAudio = () => runTransform('decrypt');

	const goToVideoPage = () => {
		uni.navigateTo({
			url: '/pages/record/record'
		});
	};

	onBeforeUnmount(() => {
		stopTimer();
		resetPlayer();
	});
</script>

<style>
	.page {
		min-height: 100vh;
		padding: 28rpx 28rpx 40rpx;
		box-sizing: border-box;
		background:
			radial-gradient(circle at top right, rgba(255, 166, 77, 0.24), transparent 32%),
			linear-gradient(180deg, #fffaf2 0%, #eef7ff 100%);
	}

	.hero {
		padding: 16rpx 8rpx 28rpx;
	}

	.eyebrow {
		display: block;
		font-size: 22rpx;
		letter-spacing: 4rpx;
		color: #b35c00;
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

	.panel,
	.log-panel {
		margin-top: 24rpx;
		padding: 26rpx;
		border-radius: 24rpx;
		background: rgba(255, 255, 255, 0.78);
		box-shadow: 0 18rpx 36rpx rgba(15, 23, 42, 0.06);
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
		background: #0f766e;
		color: #ffffff;
	}

	.action.warn {
		background: #c2410c;
		color: #ffffff;
	}

	.action.ghost {
		background: #dbeafe;
		color: #1d4ed8;
	}

	.log-list {
		display: flex;
		flex-direction: column;
		gap: 8rpx;
	}
</style>
