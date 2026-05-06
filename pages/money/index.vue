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
			<scroll-view scroll-y class="content">
				<view class="hero-card">
					<view class="hero-row">
						<view>
							<view class="hero-date">{{ todayText }}</view>
							<view class="hero-name">towYangLife</view>
						</view>
						<view class="hero-amount">{{ formatMoney(totalAssets, true) }}</view>
					</view>
					<view class="hero-stats">
						<view>
							<text class="stat-label">可消费</text>
							<text class="stat-value">{{ formatMoney(summary.totals.consumableBalance) }}</text>
						</view>
						<view>
							<text class="stat-label">存款/不可消费</text>
							<text class="stat-value">{{ formatMoney(summary.totals.protectedBalance) }}</text>
						</view>
						<view>
							<text class="stat-label">总支出</text>
							<text class="stat-value danger-text">{{ formatMoney(summary.totals.expense) }}</text>
						</view>
					</view>
				</view>

				<view v-if="activeTab === 'today'" class="panel">
					<view class="section-header">
						<view>
							<view class="section-title">今日记录</view>
							<view class="section-subtitle">{{ fullDateText }}</view>
						</view>
						<text class="refresh" @click="loadAll">刷新</text>
					</view>
					<view class="summary-strip">
						<view>
							<text>收入</text>
							<strong>{{ formatMoney(todayTotals.income) }}</strong>
						</view>
						<view>
							<text>支出</text>
							<strong class="danger-text">{{ formatMoney(todayTotals.expense) }}</strong>
						</view>
						<view>
							<text>存款</text>
							<strong>{{ formatMoney(todayTotals.deposit) }}</strong>
						</view>
					</view>
					<view v-if="!todayRecords.length" class="empty">今天还没有记录，点底部 + 记一笔。</view>
					<view v-else class="timeline">
						<view v-for="record in todayRecords" :key="record._id" class="record-item">
							<view class="record-dot"><text>{{ recordIcon(record.type) }}</text></view>
							<view class="record-main">
								<view class="record-name">{{ record.note || recordTypeText(record.type) }}</view>
								<view class="record-note">{{ recordTypeText(record.type) }}</view>
							</view>
							<view class="record-side">
								<view :class="['record-amount', record.type === 'expense' ? 'danger-text' : '']">
									{{ recordAmountText(record) }}
								</view>
								<view class="record-time">{{ shortDate(record.occurred_at) }}</view>
							</view>
						</view>
						<view class="the-end">The end</view>
					</view>
				</view>

				<view v-else class="panel">
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
					<view class="section-title small-title">周期明细</view>
					<view v-if="!summary.periodRecords.length" class="empty">当前周期暂无记录。</view>
					<view v-else class="timeline">
						<view v-for="record in summary.periodRecords" :key="record._id" class="record-item">
							<view class="record-dot"><text>{{ recordIcon(record.type) }}</text></view>
							<view class="record-main">
								<view class="record-name">{{ record.note || recordTypeText(record.type) }}</view>
								<view class="record-note">{{ recordTypeText(record.type) }}</view>
							</view>
							<view class="record-side">
								<view :class="['record-amount', record.type === 'expense' ? 'danger-text' : '']">
									{{ recordAmountText(record) }}
								</view>
								<view class="record-time">{{ shortDate(record.occurred_at) }}</view>
							</view>
						</view>
						<view class="the-end">The end</view>
					</view>
				</view>
			</scroll-view>

			<view class="bottom-tabbar">
				<view :class="['tab-item', activeTab === 'today' ? 'active' : '']" @click="activeTab = 'today'">
					<text class="tab-icon">今</text>
					<text>今日记录</text>
				</view>
				<view class="tab-create" @click="openRecordForm">
					<text>+</text>
				</view>
				<view :class="['tab-item', activeTab === 'stats' ? 'active' : '']" @click="activeTab = 'stats'">
					<text class="tab-icon">统</text>
					<text>统计</text>
				</view>
			</view>
		</view>

		<view v-if="showRecordForm" class="modal-mask">
			<view class="modal">
				<view class="modal-title">新建记录</view>
				<view class="type-tabs">
					<text :class="{ active: recordForm.type === 'income' }" @click="recordForm.type = 'income'">收入</text>
					<text :class="{ active: recordForm.type === 'expense' }" @click="recordForm.type = 'expense'">支出</text>
					<text :class="{ active: recordForm.type === 'deposit' }" @click="recordForm.type = 'deposit'">存款</text>
				</view>
				<input class="input" type="digit" v-model="recordForm.amount" placeholder="金额，如 12.5" />
				<picker mode="date" :value="recordForm.occurredDate" @change="recordForm.occurredDate = $event.detail.value">
					<view class="picker">{{ recordForm.occurredDate }}</view>
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
			records: [],
			summary: this.getEmptySummary(),
			showRecordForm: false,
			recordForm: {
				type: 'expense',
				amount: '',
				note: '',
				occurredDate: ''
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
		totalAssets() {
			return this.summary.totals.consumableBalance + this.summary.totals.protectedBalance;
		},
		todayRecords() {
			const range = this.getPeriodRange('day');
			return this.records.filter((record) => record.occurred_at >= range.startAt && record.occurred_at < range.endAt);
		},
		todayTotals() {
			return this.sumRecords(this.todayRecords);
		},
		statRangeLabel() {
			const range = this.getPeriodRange(this.statPeriod);
			return `${this.formatDateText(range.startAt)} 至 ${this.formatDateText(range.endAt - 1)}`;
		}
	},
	onLoad() {
		this.recordForm.occurredDate = this.formatDateInput(Date.now());
		this.init();
	},
	methods: {
		getEmptySummary() {
			return {
				totals: {
					income: 0,
					expense: 0,
					deposit: 0,
					consumableBalance: 0,
					protectedBalance: 0,
					periodIncome: 0,
					periodExpense: 0,
					periodDeposit: 0,
					periodNet: 0,
					monthExpense: 0,
					monthIncome: 0
				},
				periodRecords: []
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
		async loadAll() {
			try {
				const range = this.getPeriodRange(this.statPeriod);
				const [recordData, summaryData] = await Promise.all([
					this.callMoney('listRecords', { limit: 200 }),
					this.callMoney('getSummary', range)
				]);
				this.records = recordData.records || [];
				this.summary = summaryData || this.getEmptySummary();
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			}
		},
		changePeriod(period) {
			this.statPeriod = period;
			this.loadAll();
		},
		openRecordForm() {
			this.recordForm = {
				type: 'expense',
				amount: '',
				note: '',
				occurredDate: this.formatDateInput(Date.now())
			};
			this.showRecordForm = true;
		},
		async submitRecord() {
			if (!this.recordForm.amount) {
				return uni.showToast({ title: '请输入金额', icon: 'none' });
			}

			this.submitting = true;
			try {
				await this.callMoney('createRecord', {
					type: this.recordForm.type,
					amount: this.recordForm.amount,
					note: this.recordForm.note,
					occurredAt: new Date(`${this.recordForm.occurredDate} 12:00:00`).getTime()
				});
				this.showRecordForm = false;
				await this.loadAll();
				uni.showToast({ title: '已保存', icon: 'success' });
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.submitting = false;
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
		sumRecords(records) {
			return records.reduce(
				(sum, record) => {
					sum[record.type] += Number(record.amount || 0);
					return sum;
				},
				{ income: 0, expense: 0, deposit: 0 }
			);
		},
		formatDateInput(timestamp) {
			const date = new Date(timestamp);
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			return `${year}-${month}-${day}`;
		},
		formatDateText(timestamp) {
			const date = new Date(timestamp);
			return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
		},
		shortDate(timestamp) {
			const date = new Date(timestamp);
			return `${String(date.getMonth() + 1).padStart(2, '0')}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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

.hero-row,
.hero-stats,
.section-header,
.record-item,
.summary-strip,
.bottom-tabbar,
.modal-actions {
	display: flex;
	align-items: center;
}

.hero-row,
.section-header,
.record-item,
.summary-strip {
	justify-content: space-between;
}

.hero-date {
	font-size: 34rpx;
	font-weight: 700;
}

.hero-name {
	margin-top: 18rpx;
	color: rgba(255, 255, 255, 0.65);
	font-size: 24rpx;
}

.hero-amount {
	font-size: 56rpx;
	font-weight: 800;
	letter-spacing: 1rpx;
}

.hero-stats {
	gap: 20rpx;
	margin-top: 34rpx;
}

.hero-stats view {
	flex: 1;
}

.stat-label,
.stat-value {
	display: block;
}

.stat-label {
	color: rgba(255, 255, 255, 0.58);
	font-size: 22rpx;
}

.stat-value {
	margin-top: 8rpx;
	font-size: 26rpx;
	font-weight: 700;
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

.small-title {
	margin-top: 28rpx;
	font-size: 28rpx;
}

.refresh {
	color: #667085;
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

.record-dot {
	width: 72rpx;
	height: 72rpx;
	margin-right: 20rpx;
	border-radius: 50%;
	background: #f5f7fb;
	border: 1px solid #e4e7ec;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 22rpx;
	font-weight: 700;
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

.the-end {
	margin: 22rpx 0 4rpx 92rpx;
	color: #101828;
	font-size: 24rpx;
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
	justify-content: space-between;
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

.tab-create {
	width: 100rpx;
	height: 100rpx;
	margin-top: -52rpx;
	border-radius: 50%;
	background: #282321;
	color: #ffffff;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 14rpx 40rpx rgba(40, 35, 33, 0.35);
}

.tab-create text {
	font-size: 64rpx;
	line-height: 1;
	margin-top: -8rpx;
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
