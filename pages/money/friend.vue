<template>
	<view class="page">
		<view class="header">
			<view class="title">{{ friendName || '朋友详情' }}</view>
			<view class="subtitle">与该朋友的人情收支记录</view>
		</view>
		<view class="summary">
			<view class="card">
				<text>收礼</text>
				<strong>{{ formatMoney(summary.income) }}</strong>
			</view>
			<view class="card">
				<text>送礼</text>
				<strong class="danger">{{ formatMoney(summary.expense) }}</strong>
			</view>
			<view class="card">
				<text>净额</text>
				<strong>{{ formatMoney(summary.net, true) }}</strong>
			</view>
		</view>
		<view v-if="!records.length && !loading" class="empty">暂无记录</view>
		<view v-else class="list">
			<view v-for="item in records" :key="item._id" class="row">
				<view>
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
				const list = data.records || [];
				this.records = reset ? list : this.records.concat(list);
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
.page { min-height: 100vh; background: #f8f8f8; padding: 20rpx; }
.header { margin-bottom: 18rpx; }
.title { font-size: 36rpx; font-weight: 700; }
.subtitle { margin-top: 8rpx; color: #667085; font-size: 24rpx; }
.summary { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.card { flex: 1; background: #fff; border-radius: 14rpx; padding: 18rpx; }
.card text { color: #667085; font-size: 22rpx; }
.card strong { display: block; margin-top: 8rpx; font-size: 30rpx; }
.list { background: #fff; border-radius: 14rpx; padding: 0 18rpx; }
.row { min-height: 110rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f0f0f0; }
.name { font-size: 30rpx; font-weight: 600; }
.time { margin-top: 6rpx; color: #667085; font-size: 24rpx; }
.amount { font-size: 30rpx; font-weight: 700; }
.danger { color: #c8171d; }
.more, .empty { text-align: center; color: #667085; padding: 26rpx 0; }
</style>
