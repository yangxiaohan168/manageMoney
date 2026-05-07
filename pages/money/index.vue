<template>
	<view class="page">
		<view v-if="loading" class="loading">加载中...</view>

		<view v-else-if="!authenticated" class="auth-page">
			<view class="auth-card">
				<view class="brand">一起存钱</view>
				<view class="auth-title">{{ hasPassword ? '输入管理密码' : '首次设置管理密码' }}</view>
				<view class="auth-desc">
					{{ hasPassword ? '本机缓存验证通过后可直接进入。' : '密码会加密存入云数据库，用于防止外人拿到链接后管理账本。' }}
				</view>
				<input class="input" type="password" v-model="passwordInput" placeholder="请输入密码" />
				<input v-if="!hasPassword" class="input" type="password" v-model="confirmPasswordInput" placeholder="再次输入密码" />
				<button class="primary-btn" :loading="submitting" @click="submitAuth">
					{{ hasPassword ? '进入账本' : '设置并进入' }}
				</button>
			</view>
		</view>

		<view v-else class="app-shell">
			<scroll-view
				scroll-y
				class="content"
				:refresher-enabled="true"
				:refresher-triggered="refreshing"
				@refresherrefresh="handleRefresh"
			>
				<view v-if="activeTab === 'today'" class="hero-card">
					<view class="hero-date">{{ todayText }}</view>
					<view class="hero-profit-label">今日收支</view>
					<view :class="['hero-profit-amount', todayProfitLoss < 0 ? 'hero-profit-loss' : '']">
						{{ formatMoney(todayProfitLoss, true) }}
					</view>
				</view>

				<view v-if="activeTab === 'today'" class="panel">
					<view class="section-header">
						<view>
							<view class="section-title">今日记录</view>
							<view class="section-subtitle">{{ fullDateText }}</view>
						</view>
						<view class="header-actions">
							<text class="refresh" @click="loadAll">刷新</text>
							<text class="add-record-btn" @click="openRecordForm()">+ 新建</text>
						</view>
					</view>
					<view v-if="!todayList.length && !todayLoading" class="empty">今天还没有记录，点“+ 新建”记一笔。</view>
					<view v-else-if="todayList.length" class="timeline">
						<uni-swipe-action>
							<uni-swipe-action-item
								v-for="(record, index) in todayList"
								:key="record._id"
								:right-options="recordActionOptions"
								@click="onRecordActionClick($event, record)"
							>
								<view class="record-item">
							<view class="record-node">
								<view v-if="index !== 0" class="node-line top-line"></view>
								<view class="record-dot"><text>{{ recordIcon(record.type) }}</text></view>
								<view v-if="index !== todayList.length - 1" class="node-line bottom-line"></view>
							</view>
							<view class="record-main">
								<view class="record-name">{{ recordDisplayName(record) }}</view>
								<view class="record-note">{{ recordTypeText(record.type) }}{{ record.note ? ' · ' + record.note : '' }}</view>
							</view>
							<view class="record-side">
								<view :class="['record-amount', record.type === 'expense' ? 'danger-text' : '']">
									{{ recordAmountText(record) }}
								</view>
								<view class="record-time">{{ shortDate(record.occurred_at) }}</view>
							</view>
								</view>
							</uni-swipe-action-item>
						</uni-swipe-action>
						<view v-if="todayHasMore" class="load-more" @click="fetchTodayRecords(false)">
							<text v-if="todayLoading">加载中…</text>
							<text v-else>加载更多（{{ todayList.length }}/{{ todayTotal }}）</text>
						</view>
					</view>
					<view v-else-if="todayLoading" class="empty">加载中…</view>
				</view>

				<view v-else-if="activeTab === 'stats'" class="panel">
					<view class="section-title">统计</view>
					<view class="period-tabs">
						<text
							v-for="item in periodOptions"
							:key="item.value"
							:class="{ active: statPeriod === item.value }"
							@click="changePeriod(item.value)"
						>
							{{ item.label }}
						</text>
					</view>
					<view class="period-label">{{ statRangeLabel }}</view>
					<view class="summary-grid">
						<view class="summary-card">
							<text>周期收入</text>
							<strong>{{ formatMoney(summary.totals.periodIncome) }}</strong>
						</view>
						<view class="summary-card">
							<text>周期支出</text>
							<strong class="danger-text">{{ formatMoney(summary.totals.periodExpense) }}</strong>
						</view>
						<view class="summary-card">
							<text>周期存款</text>
							<strong>{{ formatMoney(summary.totals.periodDeposit) }}</strong>
						</view>
						<view class="summary-card">
							<text>周期净额</text>
							<strong>{{ formatMoney(summary.totals.periodNet, true) }}</strong>
						</view>
					</view>
				</view>

				<view v-else class="panel">
					<view class="section-header">
						<view>
							<view class="section-title">存款</view>
							<view class="section-subtitle">存款记录</view>
						</view>
						<view class="header-actions">
							<text class="add-record-btn" @click="openRecordForm('deposit')">新建存款</text>
						</view>
					</view>
					<view class="summary-strip">
						<view>
							<text>总存款</text>
							<strong>{{ formatMoney(summary.totals.deposit) }}</strong>
						</view>
					</view>
					<view v-if="!depositList.length && !depositLoading" class="empty">还没有存款记录。</view>
					<view v-else-if="depositList.length" class="timeline">
						<uni-swipe-action>
							<uni-swipe-action-item
								v-for="(record, index) in depositList"
								:key="record._id"
								:right-options="recordActionOptions"
								@click="onRecordActionClick($event, record)"
							>
								<view class="record-item">
							<view class="record-node">
								<view v-if="index !== 0" class="node-line top-line"></view>
								<view class="record-dot"><text>{{ recordIcon(record.type) }}</text></view>
								<view v-if="index !== depositList.length - 1" class="node-line bottom-line"></view>
							</view>
							<view class="record-main">
								<view class="record-name">{{ recordDisplayName(record) }}</view>
								<view class="record-note">存款{{ record.note ? ' · ' + record.note : '' }}</view>
							</view>
							<view class="record-side">
								<view class="record-amount">{{ recordAmountText(record) }}</view>
								<view class="record-time">{{ shortDate(record.occurred_at) }}</view>
							</view>
								</view>
							</uni-swipe-action-item>
						</uni-swipe-action>
						<view v-if="depositHasMore" class="load-more" @click="fetchDepositRecords(false)">
							<text v-if="depositLoading">加载中…</text>
							<text v-else>加载更多（{{ depositList.length }}/{{ depositTotal }}）</text>
						</view>
					</view>
					<view v-else-if="depositLoading" class="empty">加载中…</view>
				</view>
			</scroll-view>

			<view class="bottom-tabbar">
				<view :class="['tab-item', activeTab === 'today' ? 'active' : '']" @click="activeTab = 'today'">
					<text class="tab-icon">今</text>
					<text>今日记录</text>
				</view>
				<view :class="['tab-item', activeTab === 'stats' ? 'active' : '']" @click="activeTab = 'stats'">
					<text class="tab-icon">统</text>
					<text>统计</text>
				</view>
				<view :class="['tab-item', activeTab === 'deposit' ? 'active' : '']" @click="activeTab = 'deposit'">
					<text class="tab-icon">存</text>
					<text>存款</text>
				</view>
			</view>
		</view>

		<view v-if="showRecordForm" class="modal-mask">
			<view class="modal">
				<view class="modal-title">{{ editingRecordId ? '编辑记录' : '新建记录' }}</view>
				<view v-if="recordForm.type !== 'deposit'" class="type-tabs">
					<text :class="{ active: recordForm.type === 'income' }" @click="recordForm.type = 'income'">收入</text>
					<text :class="{ active: recordForm.type === 'expense' }" @click="recordForm.type = 'expense'">支出</text>
				</view>
				<view v-else class="deposit-form-tip">新建存款</view>
				<input class="input" v-model="recordForm.name" placeholder="记录名，如 买菜 / 公众号收入 / 定期存款" />
				<input class="input" type="digit" v-model="recordForm.amount" placeholder="金额，如 12.5" />
				<picker mode="date" :value="recordForm.occurredDate" @change="recordForm.occurredDate = $event.detail.value">
					<view class="picker">{{ recordForm.occurredDate }}</view>
				</picker>
				<picker mode="time" :value="recordForm.occurredTime" @change="recordForm.occurredTime = $event.detail.value">
					<view class="picker">{{ recordForm.occurredTime }}</view>
				</picker>
				<input class="input" v-model="recordForm.note" placeholder="备注，可不填" />
				<view class="modal-actions">
					<button @click="showRecordForm = false">取消</button>
					<button class="primary-btn" :loading="submitting" @click="submitRecord">保存</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
const TOKEN_KEY = 'money_auth_token';

export default {
	data() {
		return {
			loading: true,
			submitting: false,
			hasPassword: false,
			authenticated: false,
			token: '',
			passwordInput: '',
			confirmPasswordInput: '',
			activeTab: 'today',
			statPeriod: 'month',
			summary: this.getEmptySummary(),
			todaySummary: this.getEmptySummary(),
			todayList: [],
			todayPage: 1,
			todayTotal: 0,
			todayHasMore: false,
			todayLoading: false,
			depositList: [],
			depositPage: 1,
			depositTotal: 0,
			depositHasMore: false,
			depositLoading: false,
			refreshing: false,
			editingRecordId: '',
			recordActionOptions: [
				{ text: '编辑', style: { backgroundColor: '#282321' } },
				{ text: '删除', style: { backgroundColor: '#c8171d' } }
			],
			showRecordForm: false,
			recordForm: {
				type: 'expense',
				name: '',
				amount: '',
				note: '',
				occurredDate: '',
				occurredTime: ''
			},
			periodOptions: [
				{ label: '日', value: 'day' },
				{ label: '周', value: 'week' },
				{ label: '月', value: 'month' },
				{ label: '年', value: 'year' }
			]
		};
	},
	computed: {
		todayText() {
			return `${String(new Date().getDate()).padStart(2, '0')}日`;
		},
		fullDateText() {
			const date = new Date();
			return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
		},
		todayProfitLoss() {
			const t = this.todaySummary && this.todaySummary.totals;
			if (!t) return 0;
			return (t.periodIncome || 0) - (t.periodExpense || 0);
		},
		statRangeLabel() {
			const range = this.getPeriodRange(this.statPeriod);
			return `${this.formatDateText(range.startAt)} 至 ${this.formatDateText(range.endAt - 1)}`;
		}
	},
	onLoad() {
		this.recordForm.occurredDate = this.formatDateInput(Date.now());
		this.recordForm.occurredTime = this.formatTimeInput(Date.now());
		this.init();
	},
	methods: {
		getEmptySummary() {
			return {
				totals: {
					deposit: 0,
					periodIncome: 0,
					periodExpense: 0,
					periodDeposit: 0,
					periodNet: 0
				}
			};
		},
		async callMoney(action, payload = {}, withToken = true) {
			const res = await uniCloud.callFunction({
				name: 'money-api',
				data: {
					action,
					token: withToken ? this.token : '',
					payload
				}
			});
			const result = res.result || {};
			if (result.code !== 0) {
				throw new Error(result.msg || '操作失败');
			}
			return result.data || {};
		},
		async init() {
			this.loading = true;
			try {
				const authState = await this.callMoney('getAuthState', {}, false);
				this.hasPassword = authState.hasPassword;
				this.token = uni.getStorageSync(TOKEN_KEY) || '';
				if (this.hasPassword && this.token) {
					await this.callMoney('verifyToken', { token: this.token }, false);
					this.authenticated = true;
					await this.loadAll();
				}
			} catch (e) {
				this.authenticated = false;
				uni.removeStorageSync(TOKEN_KEY);
			} finally {
				this.loading = false;
			}
		},
		async submitAuth() {
			const password = this.passwordInput.trim();
			if (password.length < 4) {
				return uni.showToast({ title: '密码至少 4 位', icon: 'none' });
			}
			if (!this.hasPassword && password !== this.confirmPasswordInput.trim()) {
				return uni.showToast({ title: '两次密码不一致', icon: 'none' });
			}

			this.submitting = true;
			try {
				if (!this.hasPassword) {
					const authState = await this.callMoney('getAuthState', {}, false);
					this.hasPassword = !!authState.hasPassword;
					if (!this.hasPassword && password !== this.confirmPasswordInput.trim()) {
						return uni.showToast({ title: '两次密码不一致', icon: 'none' });
					}
				}
				const action = this.hasPassword ? 'login' : 'setupPassword';
				const data = await this.callMoney(action, { password }, false);
				this.token = data.token;
				uni.setStorageSync(TOKEN_KEY, data.token);
				this.authenticated = true;
				this.hasPassword = true;
				this.passwordInput = '';
				this.confirmPasswordInput = '';
				await this.loadAll();
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.submitting = false;
			}
		},
		async loadSummary() {
			const range = this.getPeriodRange(this.statPeriod);
			const dayRange = this.getPeriodRange('day');
			const [summaryData, todaySummaryData] = await Promise.all([
				this.callMoney('getSummary', range),
				this.callMoney('getSummary', dayRange)
			]);
			this.summary = summaryData || this.getEmptySummary();
			this.todaySummary = todaySummaryData || this.getEmptySummary();
		},
		async loadAll() {
			try {
				await this.loadSummary();
				await Promise.all([this.fetchTodayRecords(true), this.fetchDepositRecords(true)]);
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			}
		},
		async fetchTodayRecords(reset) {
			if (this.todayLoading) return;
			if (reset) {
				this.todayPage = 1;
				this.todayList = [];
				this.todayHasMore = false;
				this.todayTotal = 0;
			} else if (!this.todayHasMore) {
				return;
			}
			const page = reset ? 1 : this.todayPage + 1;
			this.todayLoading = true;
			try {
				const range = this.getPeriodRange('day');
				const data = await this.callMoney('listRecords', {
					types: ['income', 'expense'],
					startAt: range.startAt,
					endAt: range.endAt,
					page,
					pageSize: 10
				});
				const list = data.records || [];
				if (reset) {
					this.todayList = list;
				} else {
					this.todayList = this.todayList.concat(list);
				}
				this.todayPage = data.page;
				this.todayTotal = data.total;
				this.todayHasMore = !!data.hasMore;
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.todayLoading = false;
			}
		},
		async fetchDepositRecords(reset) {
			if (this.depositLoading) return;
			if (reset) {
				this.depositPage = 1;
				this.depositList = [];
				this.depositHasMore = false;
				this.depositTotal = 0;
			} else if (!this.depositHasMore) {
				return;
			}
			const page = reset ? 1 : this.depositPage + 1;
			this.depositLoading = true;
			try {
				const data = await this.callMoney('listRecords', {
					types: ['deposit'],
					page,
					pageSize: 10
				});
				const list = data.records || [];
				if (reset) {
					this.depositList = list;
				} else {
					this.depositList = this.depositList.concat(list);
				}
				this.depositPage = data.page;
				this.depositTotal = data.total;
				this.depositHasMore = !!data.hasMore;
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.depositLoading = false;
			}
		},
		async changePeriod(period) {
			this.statPeriod = period;
			try {
				await this.loadSummary();
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			}
		},
		openRecordForm(type = 'expense', record = null) {
			if (record && record._id) {
				this.editingRecordId = record._id;
				this.recordForm = {
					type: record.type,
					name: record.name || '',
					amount: ((Number(record.amount || 0)) / 100).toString(),
					note: record.note || '',
					occurredDate: this.formatDateInput(record.occurred_at || Date.now()),
					occurredTime: this.formatTimeInput(record.occurred_at || Date.now())
				};
				this.showRecordForm = true;
				return;
			}
			this.editingRecordId = '';
			this.recordForm = {
				type,
				name: '',
				amount: '',
				note: '',
				occurredDate: this.formatDateInput(Date.now()),
				occurredTime: this.formatTimeInput(Date.now())
			};
			this.showRecordForm = true;
		},
		async submitRecord() {
			if (!this.recordForm.name.trim()) {
				return uni.showToast({ title: '请输入记录名', icon: 'none' });
			}
			if (!this.recordForm.amount) {
				return uni.showToast({ title: '请输入金额', icon: 'none' });
			}

			this.submitting = true;
			try {
				const isEdit = !!this.editingRecordId;
				const payload = {
					type: this.recordForm.type,
					name: this.recordForm.name,
					amount: this.recordForm.amount,
					note: this.recordForm.note,
					occurredAt: this.getRecordTimestamp()
				};
				if (this.editingRecordId) {
					await this.callMoney('updateRecord', { id: this.editingRecordId, ...payload });
				} else {
					await this.callMoney('createRecord', payload);
				}
				this.showRecordForm = false;
				this.editingRecordId = '';
				await this.loadAll();
				uni.showToast({ title: isEdit ? '已更新' : '已保存', icon: 'success' });
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.submitting = false;
			}
		},
		async onRecordActionClick(e, record) {
			const idx = Number(e && e.index);
			if (idx === 0) {
				this.openRecordForm(record.type, record);
				return;
			}
			if (idx === 1) {
				await this.removeRecord(record);
			}
		},
		async removeRecord(record) {
			const that = this;
			uni.showModal({
				title: '删除记录',
				content: `确认删除「${this.recordDisplayName(record)}」吗？`,
				success: async (res) => {
					if (!res.confirm) return;
					try {
						await that.callMoney('deleteRecord', { id: record._id });
						await that.loadAll();
						uni.showToast({ title: '已删除', icon: 'success' });
					} catch (e) {
						uni.showToast({ title: e.message, icon: 'none' });
					}
				}
			});
		},
		async handleRefresh() {
			if (this.refreshing) return;
			this.refreshing = true;
			try {
				await this.loadAll();
			} finally {
				this.refreshing = false;
			}
		},
		getPeriodRange(period) {
			const now = new Date();
			let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			let end = new Date(start);
			if (period === 'week') {
				const day = start.getDay() || 7;
				start = new Date(start.getFullYear(), start.getMonth(), start.getDate() - day + 1);
				end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
			} else if (period === 'month') {
				start = new Date(now.getFullYear(), now.getMonth(), 1);
				end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
			} else if (period === 'year') {
				start = new Date(now.getFullYear(), 0, 1);
				end = new Date(now.getFullYear() + 1, 0, 1);
			} else {
				end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
			}
			return { startAt: start.getTime(), endAt: end.getTime() };
		},
		formatDateInput(timestamp) {
			const date = new Date(timestamp);
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			return `${year}-${month}-${day}`;
		},
		formatTimeInput(timestamp) {
			const date = new Date(timestamp);
			const hours = String(date.getHours()).padStart(2, '0');
			const minutes = String(date.getMinutes()).padStart(2, '0');
			return `${hours}:${minutes}`;
		},
		getRecordTimestamp() {
			const dateStr = this.recordForm.occurredDate || this.formatDateInput(Date.now());
			const timeStr = this.recordForm.occurredTime || this.formatTimeInput(Date.now());
			const [year, month, day] = dateStr.split('-').map(Number);
			const [hour, minute] = timeStr.split(':').map(Number);
			const h = Number.isFinite(hour) ? hour : new Date().getHours();
			const min = Number.isFinite(minute) ? minute : new Date().getMinutes();
			const t = new Date(year, month - 1, day, h, min, 0, 0).getTime();
			return Number.isFinite(t) ? t : Date.now();
		},
		formatDateText(timestamp) {
			const date = new Date(timestamp);
			return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
		},
		shortDate(timestamp) {
			const ts = Number(timestamp);
			if (!Number.isFinite(ts)) return '';
			const date = new Date(ts);
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
		},
		recordTypeText(type) {
			return { income: '收入', expense: '支出', deposit: '存款' }[type] || '记录';
		},
		recordIcon(type) {
			return { income: '入', expense: '支', deposit: '存' }[type] || '记';
		},
		recordDisplayName(record) {
			return record.name || record.note || this.recordTypeText(record.type);
		},
		recordAmountText(record) {
			return `${record.type === 'expense' ? '-' : '+'}${this.formatMoney(record.amount)}`;
		}
	}
};
</script>

<style>
.page {
	min-height: 100vh;
	background: #f8f8f8;
	color: #101828;
}

.loading,
.empty {
	padding: 80rpx 32rpx;
	text-align: center;
	color: #667085;
}

.load-more {
	margin: 8rpx 0 16rpx;
	padding: 28rpx;
	text-align: center;
	color: #667085;
	font-size: 26rpx;
}

.auth-page {
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 40rpx;
	background: #f5f1ee;
}

.auth-card,
.panel,
.modal {
	background: #ffffff;
	border-radius: 28rpx;
	box-shadow: 0 20rpx 60rpx rgba(16, 24, 40, 0.08);
}

.auth-card {
	width: 100%;
	max-width: 640rpx;
	padding: 48rpx 36rpx;
}

.brand {
	color: #7a6a63;
	font-size: 26rpx;
	margin-bottom: 24rpx;
}

.auth-title {
	font-size: 40rpx;
	font-weight: 700;
	margin-bottom: 16rpx;
}

.auth-desc,
.section-subtitle,
.record-note,
.record-time,
.summary-card text,
.summary-strip text,
.period-label {
	color: #667085;
	font-size: 24rpx;
}

.auth-desc {
	line-height: 1.6;
	margin-bottom: 32rpx;
}

.input,
.picker {
	min-height: 88rpx;
	line-height: 88rpx;
	padding: 0 24rpx;
	margin-bottom: 20rpx;
	border-radius: 18rpx;
	background: #f7f7f7;
	font-size: 28rpx;
}

.primary-btn {
	background: #282321;
	color: #ffffff;
	border-radius: 18rpx;
}

.app-shell {
	min-height: 100vh;
}

.content {
	height: 100vh;
	padding: 12rpx 12rpx 160rpx;
	box-sizing: border-box;
}

.hero-card {
	padding: 28rpx 32rpx;
	border-radius: 20rpx;
	background: #282321;
	color: #ffffff;
}

.section-header,
.record-item,
.summary-strip,
.bottom-tabbar,
.modal-actions {
	display: flex;
	align-items: center;
}

.section-header,
.record-item,
.summary-strip {
	justify-content: space-between;
}

.hero-date {
	font-size: 34rpx;
	font-weight: 700;
}

.hero-profit-label {
	margin-top: 10rpx;
	color: rgba(255, 255, 255, 0.58);
	font-size: 24rpx;
}

.hero-profit-amount {
	margin-top: 12rpx;
	font-size: 56rpx;
	font-weight: 800;
	letter-spacing: 1rpx;
}

.hero-profit-loss {
	color: #c8171d;
}

.panel {
	margin-top: 22rpx;
	padding: 28rpx;
	box-shadow: none;
}

.section-title {
	font-size: 32rpx;
	font-weight: 800;
	margin-bottom: 18rpx;
}

.refresh {
	color: #667085;
	font-size: 24rpx;
}

.header-actions {
	display: flex;
	align-items: center;
	gap: 18rpx;
}

.add-record-btn {
	padding: 12rpx 22rpx;
	border-radius: 999rpx;
	background: #282321;
	color: #ffffff;
	font-size: 24rpx;
}

.summary-strip {
	gap: 16rpx;
	margin: 24rpx 0;
}

.summary-strip view {
	flex: 1;
	padding: 22rpx;
	border-radius: 18rpx;
	background: #f7f7f7;
}

.summary-strip strong,
.summary-card strong {
	display: block;
	margin-top: 10rpx;
	font-size: 30rpx;
}

.summary-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 16rpx;
	margin-top: 20rpx;
}

.summary-card {
	padding: 22rpx;
	border-radius: 18rpx;
	background: #f7f7f7;
}

.period-tabs {
	display: flex;
	gap: 14rpx;
	margin-bottom: 14rpx;
}

.period-tabs text {
	flex: 1;
	text-align: center;
	padding: 16rpx 0;
	border-radius: 999rpx;
	background: #f2f4f7;
	color: #667085;
	font-size: 26rpx;
}

.period-tabs .active {
	background: #282321;
	color: #ffffff;
}

.danger-text {
	color: #c8171d !important;
}

.timeline {
	position: relative;
}

.record-item {
	min-height: 116rpx;
	border-bottom: 1px solid #f0f0f0;
}

.record-node {
	position: relative;
	width: 76rpx;
	min-height: 116rpx;
	margin-right: 20rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	align-self: stretch;
}

.node-line {
	position: absolute;
	left: 36rpx;
	width: 2rpx;
	background: #d0d5dd;
}

.top-line {
	top: 0;
	bottom: 58rpx;
}

.bottom-line {
	top: 58rpx;
	bottom: 0;
}

.record-dot {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	background: #f5f7fb;
	border: 1px solid #e4e7ec;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 22rpx;
	font-weight: 700;
	z-index: 1;
}

.record-main {
	flex: 1;
}

.record-name {
	font-size: 30rpx;
	font-weight: 700;
}

.record-side {
	text-align: right;
}

.record-amount {
	font-size: 32rpx;
	font-weight: 800;
}

.bottom-tabbar {
	position: fixed;
	left: 24rpx;
	right: 24rpx;
	bottom: 24rpx;
	z-index: 10;
	height: 112rpx;
	padding: 0 26rpx;
	border-radius: 36rpx;
	background: #ffffff;
	box-shadow: 0 16rpx 50rpx rgba(16, 24, 40, 0.16);
	justify-content: space-around;
	box-sizing: border-box;
}

.tab-item {
	width: 180rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 6rpx;
	color: #667085;
	font-size: 22rpx;
}

.tab-item.active {
	color: #282321;
	font-weight: 700;
}

.tab-icon {
	font-size: 28rpx;
}

.modal-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 20;
	display: flex;
	align-items: flex-end;
	background: rgba(16, 24, 40, 0.42);
}

.modal {
	width: 100%;
	padding: 34rpx 28rpx 46rpx;
	border-radius: 32rpx 32rpx 0 0;
	box-sizing: border-box;
}

.modal-title {
	font-size: 34rpx;
	font-weight: 800;
	margin-bottom: 24rpx;
}

.type-tabs {
	display: flex;
	gap: 18rpx;
	margin-bottom: 22rpx;
}

.type-tabs text {
	padding: 14rpx 26rpx;
	border-radius: 999rpx;
	background: #f2f4f7;
	color: #667085;
	font-size: 26rpx;
}

.type-tabs .active {
	background: #282321;
	color: #ffffff;
}

.deposit-form-tip {
	display: inline-flex;
	margin-bottom: 22rpx;
	padding: 14rpx 26rpx;
	border-radius: 999rpx;
	background: #282321;
	color: #ffffff;
	font-size: 26rpx;
}

.modal-actions {
	gap: 16rpx;
	margin-top: 18rpx;
}

.modal-actions button {
	flex: 1;
	margin: 0;
	border-radius: 18rpx;
}
</style>
