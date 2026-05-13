<template>
	<view class="page">
		<view class="header">
			<view class="title">
				<uni-icons type="person-filled" size="24" color="#2563eb"></uni-icons>
				<text>{{ friendName || '朋友详情' }}</text>
			</view>
			<view class="subtitle">与该朋友的人情收支记录</view>
		</view>
		<view class="summary">
			<view class="card">
				<view class="card-label">
					<uni-icons type="gift-filled" size="16" color="#12b76a"></uni-icons>
					<text>收礼</text>
				</view>
				<strong>{{ formatMoney(summary.income) }}</strong>
			</view>
			<view class="card">
				<view class="card-label">
					<uni-icons type="paperplane-filled" size="16" color="#c8171d"></uni-icons>
					<text>送礼</text>
				</view>
				<strong class="danger">{{ formatMoney(summary.expense) }}</strong>
			</view>
			<view class="card">
				<view class="card-label">
					<uni-icons type="flag-filled" size="16" color="#f79009"></uni-icons>
					<text>净额</text>
				</view>
				<strong>{{ formatMoney(summary.net, true) }}</strong>
			</view>
		</view>
		<view v-if="!records.length && !loading" class="empty">暂无记录</view>
		<view v-else class="list">
			<view v-for="item in records" :key="item._id" class="row">
				<view :class="['row-icon', item.type === 'human_expense' ? 'expense-icon' : 'income-icon']">
					<uni-icons type="gift-filled" size="17" :color="item.type === 'human_expense' ? '#c8171d' : '#12b76a'"></uni-icons>
				</view>
				<view class="row-main">
					<view class="name">{{ item.type === 'human_income' ? '收礼' : '送礼' }}</view>
					<view class="time">{{ shortDate(item.occurred_at) }}{{ item.note ? ' · ' + item.note : '' }}</view>
				</view>
				<view :class="['amount', item.type === 'human_expense' ? 'danger' : '']">
					{{ item.type === 'human_expense' ? '-' : '+' }}{{ formatMoney(item.amount) }}
				</view>
			</view>
			<view v-if="hasMore" class="more" @click="loadRecords(false)">{{ loading ? '加载中…' : '加载更多' }}</view>
		</view>
	</view>
</template>

<script>
const TOKEN_KEY = 'money_auth_token';

export default {
	data() {
		return {
			token: '',
			friendId: '',
			friendName: '',
			records: [],
			page: 1,
			hasMore: false,
			loading: false,
			summary: { income: 0, expense: 0, net: 0 }
		};
	},
	onLoad(query) {
		this.token = uni.getStorageSync(TOKEN_KEY) || '';
		this.friendId = decodeURIComponent(query.friendId || '');
		this.friendName = decodeURIComponent(query.friendName || '');
		this.loadRecords(true);
	},
	methods: {
		async callMoney(action, payload = {}) {
			const res = await uniCloud.callFunction({
				name: 'money-api',
				data: { action, token: this.token, payload }
			});
			const result = res.result || {};
			if (result.code !== 0) throw new Error(result.msg || '操作失败');
			return result.data || {};
		},
		async loadRecords(reset) {
			if (this.loading) return;
			if (reset) {
				this.page = 1;
				this.records = [];
				this.hasMore = false;
			} else if (!this.hasMore) {
				return;
			}
			const page = reset ? 1 : this.page + 1;
			this.loading = true;
			try {
				const data = await this.callMoney('listHumanRecords', { friendId: this.friendId, page, pageSize: 10 });
				const list = this.sortRecordsByTime(data.records || []);
				this.records = this.sortRecordsByTime(reset ? list : this.records.concat(list));
				this.page = data.page || page;
				this.hasMore = !!data.hasMore;
				this.summary = this.records.reduce(
					(acc, item) => {
						if (item.type === 'human_income') acc.income += Number(item.amount || 0);
						else acc.expense += Number(item.amount || 0);
						acc.net = acc.income - acc.expense;
						return acc;
					},
					{ income: 0, expense: 0, net: 0 }
				);
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.loading = false;
			}
		},
		sortRecordsByTime(records = []) {
			return records.slice().sort((a, b) => {
				const occurredDiff = Number(b.occurred_at || 0) - Number(a.occurred_at || 0);
				if (occurredDiff) return occurredDiff;
				const createdDiff = Number(b.created_at || 0) - Number(a.created_at || 0);
				if (createdDiff) return createdDiff;
				return String(b._id || '').localeCompare(String(a._id || ''));
			});
		},
		shortDate(timestamp) {
			const date = new Date(Number(timestamp || Date.now()));
			const m = date.getMonth() + 1;
			const d = date.getDate();
			const hh = String(date.getHours()).padStart(2, '0');
			const mm = String(date.getMinutes()).padStart(2, '0');
			return `${m}月${d}日 ${hh}:${mm}`;
		},
		formatMoney(cents, withSign = false) {
			const value = Number(cents || 0) / 100;
			const sign = withSign && value > 0 ? '+' : '';
			return `${sign}${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
		}
	}
};
</script>

<style>
.page {
	min-height: 100vh;
	background: #f5f7fb;
	padding: 22rpx;
	box-sizing: border-box;
}

.header {
	margin-bottom: 20rpx;
	padding: 26rpx;
	border-radius: 16rpx;
	background: #ffffff;
	box-shadow: 0 12rpx 32rpx rgba(16, 24, 40, 0.06);
}

.title,
.card-label,
.row {
	display: flex;
	align-items: center;
}

.title {
	gap: 10rpx;
	font-size: 36rpx;
	font-weight: 800;
}

.subtitle {
	margin-top: 10rpx;
	color: #667085;
	font-size: 24rpx;
}

.summary {
	display: flex;
	gap: 12rpx;
	margin-bottom: 18rpx;
}

.card {
	flex: 1;
	background: #ffffff;
	border-radius: 16rpx;
	padding: 18rpx;
	border: 1px solid #edf2f7;
}

.card-label {
	gap: 6rpx;
}

.card text {
	color: #667085;
	font-size: 22rpx;
}

.card strong {
	display: block;
	margin-top: 10rpx;
	font-size: 30rpx;
}

.list {
	background: #ffffff;
	border-radius: 16rpx;
	padding: 0 18rpx;
	box-shadow: 0 10rpx 28rpx rgba(16, 24, 40, 0.05);
}

.row {
	min-height: 112rpx;
	gap: 16rpx;
	justify-content: space-between;
	border-bottom: 1px solid #f0f0f0;
}

.row-icon {
	width: 64rpx;
	height: 64rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.income-icon {
	background: #ecfdf3;
	border: 1px solid #abefc6;
}

.expense-icon {
	background: #fff1f3;
	border: 1px solid #fecdd6;
}

.row-main {
	flex: 1;
	min-width: 0;
}

.name {
	font-size: 30rpx;
	font-weight: 700;
}

.time {
	margin-top: 6rpx;
	color: #667085;
	font-size: 24rpx;
}

.amount {
	font-size: 30rpx;
	font-weight: 800;
	flex-shrink: 0;
	padding-right: 20rpx;
	box-sizing: border-box;
}

.danger {
	color: #c8171d;
}

.more,
.empty {
	text-align: center;
	color: #667085;
	padding: 34rpx 0;
}
</style>
