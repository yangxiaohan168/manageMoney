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
				<input
					v-if="!hasPassword"
					class="input"
					type="password"
					v-model="confirmPasswordInput"
					placeholder="再次输入密码"
				/>
				<button class="primary-btn" :loading="submitting" @click="submitAuth">
					{{ hasPassword ? '进入账本' : '设置并进入' }}
				</button>
			</view>
		</view>

		<scroll-view v-else scroll-y class="money-page">
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
						<text class="stat-label">不可消费/存款</text>
						<text class="stat-value">{{ formatMoney(summary.totals.protectedBalance) }}</text>
					</view>
					<view>
						<text class="stat-label">本月净额</text>
						<text class="stat-value">{{ formatMoney(monthNet, true) }}</text>
					</view>
				</view>
			</view>

			<view class="quick-actions">
				<button @click="openRecordForm('income')">收入</button>
				<button @click="openRecordForm('expense')">支出</button>
				<button @click="openRecordForm('deposit')">存款</button>
				<button @click="showCategoryForm = true">分类</button>
			</view>

			<view class="section">
				<view class="section-title">统计</view>
				<view class="summary-grid">
					<view class="summary-card">
						<text>总收入</text>
						<strong>{{ formatMoney(summary.totals.income) }}</strong>
					</view>
					<view class="summary-card">
						<text>总支出</text>
						<strong class="danger">{{ formatMoney(summary.totals.expense) }}</strong>
					</view>
					<view class="summary-card">
						<text>总存款</text>
						<strong>{{ formatMoney(summary.totals.deposit) }}</strong>
					</view>
					<view class="summary-card">
						<text>本月支出</text>
						<strong class="danger">{{ formatMoney(summary.totals.monthExpense) }}</strong>
					</view>
				</view>
				<view v-if="summary.expenseByCategory.length" class="rank-list">
					<view v-for="item in summary.expenseByCategory" :key="item.category_id" class="rank-item">
						<text>{{ item.category_name }}</text>
						<text>{{ formatMoney(item.amount) }}</text>
					</view>
				</view>
			</view>

			<view class="section">
				<view class="section-header">
					<view class="section-title">记录</view>
					<text class="refresh" @click="loadAll">刷新</text>
				</view>

				<view v-if="!records.length" class="empty">还没有记录，先记一笔吧。</view>
				<view v-else class="timeline">
					<view v-for="group in groupedRecords" :key="group.date" class="day-group">
						<view class="day-title">{{ group.date }}</view>
						<view v-for="record in group.records" :key="record._id" class="record-item">
							<view class="record-dot">
								<text>{{ recordIcon(record.type) }}</text>
							</view>
							<view class="record-main">
								<view class="record-name">{{ record.category_name || recordTypeText(record.type) }}</view>
								<view class="record-note">{{ record.note || recordTypeText(record.type) }}</view>
							</view>
							<view class="record-side">
								<view :class="['record-amount', record.type === 'expense' ? 'danger' : '']">
									{{ recordAmountText(record) }}
								</view>
								<view class="record-time">{{ shortDate(record.occurred_at) }}</view>
							</view>
						</view>
					</view>
					<view class="the-end">The end</view>
				</view>
			</view>
		</scroll-view>

		<view v-if="showRecordForm" class="modal-mask">
			<view class="modal">
				<view class="modal-title">新增{{ recordTypeText(recordForm.type) }}</view>
				<view class="type-tabs">
					<text :class="{ active: recordForm.type === 'income' }" @click="switchRecordType('income')">收入</text>
					<text :class="{ active: recordForm.type === 'expense' }" @click="switchRecordType('expense')">支出</text>
					<text :class="{ active: recordForm.type === 'deposit' }" @click="switchRecordType('deposit')">存款</text>
				</view>

				<input class="input" type="digit" v-model="recordForm.amount" placeholder="金额，如 12.5" />

				<picker
					v-if="recordForm.type !== 'deposit'"
					mode="selector"
					:range="categoryPickerItems"
					:value="selectedCategoryIndex"
					@change="selectedCategoryIndex = Number($event.detail.value)"
				>
					<view class="picker">
						{{ selectedCategoryName || '请选择分类' }}
					</view>
				</picker>

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

		<view v-if="showCategoryForm" class="modal-mask">
			<view class="modal">
				<view class="modal-title">收入归类</view>
				<input class="input" v-model="categoryForm.name" placeholder="分类名称，如 工资/副业/教育基金" />
				<view class="switch-row">
					<view>
						<view>允许被支出扣减</view>
						<text>关闭后会计入不可消费资产</text>
					</view>
					<switch :checked="categoryForm.canConsume" @change="categoryForm.canConsume = $event.detail.value" />
				</view>
				<button class="primary-btn" :loading="submitting" @click="submitCategory">新增分类</button>

				<view class="category-list">
					<view v-for="category in categories" :key="category._id" class="category-item">
						<text>{{ category.name }}</text>
						<text>{{ category.canConsume ? '可消费' : '不可消费' }}</text>
					</view>
				</view>

				<view class="modal-actions">
					<button @click="showCategoryForm = false">关闭</button>
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
			categories: [],
			records: [],
			summary: {
				totals: {
					income: 0,
					expense: 0,
					deposit: 0,
					consumableBalance: 0,
					protectedBalance: 0,
					monthExpense: 0,
					monthIncome: 0
				},
				expenseByCategory: []
			},
			showRecordForm: false,
			showCategoryForm: false,
			selectedCategoryIndex: 0,
			recordForm: {
				type: 'income',
				amount: '',
				note: '',
				occurredDate: ''
			},
			categoryForm: {
				name: '',
				canConsume: true
			}
		};
	},
	computed: {
		todayText() {
			const date = new Date();
			return `${String(date.getDate()).padStart(2, '0')}日`;
		},
		totalAssets() {
			return this.summary.totals.consumableBalance + this.summary.totals.protectedBalance;
		},
		monthNet() {
			return this.summary.totals.monthIncome - this.summary.totals.monthExpense;
		},
		availableCategories() {
			if (this.recordForm.type === 'expense') {
				return this.categories.filter((item) => item.canConsume);
			}
			return this.categories;
		},
		categoryPickerItems() {
			return this.availableCategories.map((item) => `${item.name}${item.canConsume ? '（可消费）' : '（不可消费）'}`);
		},
		selectedCategory() {
			return this.availableCategories[this.selectedCategoryIndex] || null;
		},
		selectedCategoryName() {
			return this.selectedCategory ? this.categoryPickerItems[this.selectedCategoryIndex] : '';
		},
		groupedRecords() {
			const groups = [];
			const map = {};
			this.records.forEach((record) => {
				const key = this.dayLabel(record.occurred_at);
				if (!map[key]) {
					map[key] = { date: key, records: [] };
					groups.push(map[key]);
				}
				map[key].records.push(record);
			});
			return groups;
		}
	},
	onLoad() {
		this.recordForm.occurredDate = this.formatDateInput(Date.now());
		this.init();
	},
	methods: {
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
				const [categoryData, recordData, summaryData] = await Promise.all([
					this.callMoney('listCategories'),
					this.callMoney('listRecords', { limit: 100 }),
					this.callMoney('getSummary', this.currentMonthRange())
				]);
				this.categories = categoryData.categories || [];
				this.records = recordData.records || [];
				this.summary = summaryData;
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			}
		},
		openRecordForm(type) {
			this.recordForm = {
				type,
				amount: '',
				note: '',
				occurredDate: this.formatDateInput(Date.now())
			};
			this.selectedCategoryIndex = 0;
			this.showRecordForm = true;
		},
		switchRecordType(type) {
			this.recordForm.type = type;
			this.selectedCategoryIndex = 0;
		},
		async submitRecord() {
			if (!this.recordForm.amount) {
				return uni.showToast({ title: '请输入金额', icon: 'none' });
			}
			if (this.recordForm.type !== 'deposit' && !this.selectedCategory) {
				return uni.showToast({ title: '请先新增可用分类', icon: 'none' });
			}

			this.submitting = true;
			try {
				await this.callMoney('createRecord', {
					type: this.recordForm.type,
					amount: this.recordForm.amount,
					categoryId: this.selectedCategory ? this.selectedCategory._id : '',
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
		async submitCategory() {
			const name = this.categoryForm.name.trim();
			if (!name) {
				return uni.showToast({ title: '请输入分类名称', icon: 'none' });
			}

			this.submitting = true;
			try {
				await this.callMoney('createCategory', {
					name,
					canConsume: this.categoryForm.canConsume
				});
				this.categoryForm.name = '';
				this.categoryForm.canConsume = true;
				await this.loadAll();
				uni.showToast({ title: '分类已新增', icon: 'success' });
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.submitting = false;
			}
		},
		currentMonthRange() {
			const date = new Date();
			const monthStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
			const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
			return { monthStart, monthEnd };
		},
		formatDateInput(timestamp) {
			const date = new Date(timestamp);
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			return `${year}-${month}-${day}`;
		},
		dayLabel(timestamp) {
			const date = new Date(timestamp);
			return `${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;
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
			return {
				income: '收入',
				expense: '支出',
				deposit: '存款'
			}[type] || '记录';
		},
		recordIcon(type) {
			return {
				income: '入',
				expense: '支',
				deposit: '存'
			}[type] || '记';
		},
		recordAmountText(record) {
			const prefix = record.type === 'expense' ? '-' : '+';
			return `${prefix}${this.formatMoney(record.amount)}`;
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
.modal,
.section {
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

.auth-desc {
	color: #667085;
	font-size: 26rpx;
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

.money-page {
	height: 100vh;
	padding: 12rpx 12rpx 60rpx;
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
.rank-item,
.category-item,
.switch-row,
.modal-actions,
.quick-actions {
	display: flex;
	align-items: center;
}

.hero-row,
.section-header,
.record-item,
.rank-item,
.category-item,
.switch-row {
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

.quick-actions {
	gap: 16rpx;
	padding: 24rpx 4rpx;
}

.quick-actions button {
	flex: 1;
	margin: 0;
	border-radius: 18rpx;
	background: #ffffff;
	font-size: 26rpx;
}

.section {
	margin: 12rpx 4rpx 24rpx;
	padding: 28rpx;
	box-shadow: none;
}

.section-title {
	font-size: 30rpx;
	font-weight: 700;
	margin-bottom: 20rpx;
}

.refresh {
	color: #667085;
	font-size: 24rpx;
}

.summary-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 16rpx;
}

.summary-card {
	padding: 22rpx;
	border-radius: 18rpx;
	background: #f7f7f7;
}

.summary-card text,
.switch-row text,
.record-note,
.record-time {
	color: #667085;
	font-size: 24rpx;
}

.summary-card strong {
	display: block;
	margin-top: 10rpx;
	font-size: 30rpx;
}

.danger {
	color: #c8171d;
}

.rank-list {
	margin-top: 18rpx;
}

.rank-item,
.category-item {
	min-height: 68rpx;
	border-bottom: 1px solid #f0f0f0;
	font-size: 26rpx;
}

.timeline {
	position: relative;
}

.day-title {
	margin: 24rpx 0 16rpx 58rpx;
	color: #667085;
	font-size: 28rpx;
}

.record-item {
	min-height: 116rpx;
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
	color: #101828;
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
	margin: 18rpx 0 8rpx 84rpx;
	color: #101828;
	font-size: 24rpx;
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

.switch-row {
	margin-bottom: 24rpx;
	padding: 22rpx;
	border-radius: 18rpx;
	background: #f7f7f7;
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

.category-list {
	max-height: 360rpx;
	margin-top: 24rpx;
	overflow: auto;
}
</style>
