<template>
	<view class="page">
		<view class="hero">
			<text class="eyebrow">uni-app Encrypt Demo</text>
			<text class="title">移动端加密验证入口</text>
			<text class="desc">用于在 Android、iOS 真机上验证录音与录像文件的加密、解密是否可用。</text>
		</view>

		<view class="card-list">
			<view class="entry-card" @click="goTo('/pages/record/home-record')">
				<text class="entry-title">音频测试页</text>
				<text class="entry-desc">录制音频，执行加密与解密验证。</text>
			</view>

			<view class="entry-card alt" @click="goTo('/pages/record/record')">
				<text class="entry-title">视频测试页</text>
				<text class="entry-desc">拍摄视频，执行头部加密与解密验证。</text>
			</view>
		</view>

		<view class="tips">
			<text class="tips-title">测试说明</text>
			<text class="tips-text">1. 请在 `APP-PLUS` 环境运行，H5 无法调用原生文件系统与录制能力。</text>
			<text class="tips-text">2. 首次运行请授予麦克风、相机、存储访问权限。</text>
			<text class="tips-text">3. 若需要更稳定验证结果，请在 Android 与 iOS 真机各测一轮。</text>
		</view>
	</view>
</template>

<script>
	export default {
		methods: {
			goTo(url) {
				uni.navigateTo({
					url
				});
			}
		}
	}
</script>

<style>
	.page {
		min-height: 100vh;
		padding: 48rpx 32rpx 56rpx;
		box-sizing: border-box;
		background:
			radial-gradient(circle at top left, rgba(28, 191, 169, 0.18), transparent 38%),
			linear-gradient(180deg, #f5fbfa 0%, #eaf3ff 100%);
	}

	.hero {
		padding: 24rpx 0 48rpx;
	}

	.eyebrow {
		display: block;
		font-size: 24rpx;
		letter-spacing: 4rpx;
		color: #11806a;
		margin-bottom: 20rpx;
	}

	.title {
		display: block;
		font-size: 56rpx;
		font-weight: 700;
		line-height: 1.2;
		color: #102a43;
	}

	.desc {
		display: block;
		margin-top: 24rpx;
		font-size: 30rpx;
		line-height: 1.8;
		color: #486581;
	}

	.card-list {
		display: flex;
		flex-direction: column;
		gap: 24rpx;
	}

	.entry-card {
		padding: 32rpx;
		border-radius: 28rpx;
		background: #102a43;
		box-shadow: 0 20rpx 40rpx rgba(16, 42, 67, 0.12);
	}

	.entry-card.alt {
		background: #176087;
	}

	.entry-title {
		display: block;
		font-size: 38rpx;
		font-weight: 600;
		color: #ffffff;
	}

	.entry-desc {
		display: block;
		margin-top: 12rpx;
		font-size: 28rpx;
		line-height: 1.7;
		color: rgba(255, 255, 255, 0.86);
	}

	.tips {
		margin-top: 36rpx;
		padding: 28rpx;
		border-radius: 24rpx;
		background: rgba(255, 255, 255, 0.72);
		backdrop-filter: blur(10px);
	}

	.tips-title {
		display: block;
		font-size: 32rpx;
		font-weight: 600;
		color: #243b53;
		margin-bottom: 12rpx;
	}

	.tips-text {
		display: block;
		font-size: 26rpx;
		line-height: 1.8;
		color: #52606d;
	}
</style>
