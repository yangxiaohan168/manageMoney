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
					<view class="hero-top">
						<view>
							<view class="hero-date">
								<uni-icons type="calendar-filled" size="19" color="#ffffff"></uni-icons>
								<text>{{ todayText }}</text>
							</view>
							<view class="hero-profit-label">{{ selectedRecordIsToday ? '今日收支' : '当日收支' }}</view>
						</view>
						<view class="hero-chip">{{ selectedRecordIsToday ? '今天' : '历史' }}</view>
					</view>
					<view :class="['hero-profit-amount', todayProfitLoss < 0 ? 'hero-profit-loss' : '']">
						{{ formatMoney(todayProfitLoss, true) }}
					</view>
					<view class="hero-metrics">
						<view>
							<text>收入</text>
							<strong>{{ formatMoney(todaySummary.totals.periodIncome) }}</strong>
						</view>
						<view>
							<text>支出</text>
							<strong>{{ formatMoney(todaySummary.totals.periodExpense) }}</strong>
						</view>
					</view>
				</view>

				<view v-if="activeTab === 'today'" class="panel">
					<view class="section-header">
						<view>
							<view class="section-title">{{ selectedRecordIsToday ? '今日记录' : '日期记录' }}</view>
							<view class="section-subtitle">{{ fullDateText }}</view>
						</view>
						<view class="header-actions">
							<view class="refresh" @click="loadAll">
								<uni-icons type="refresh" size="15" color="#667085"></uni-icons>
								<text>刷新</text>
							</view>
							<view class="add-record-btn" @click="openRecordForm()">
								<uni-icons type="plus" size="15" color="#ffffff"></uni-icons>
								<text>新建</text>
							</view>
						</view>
					</view>
					<view class="date-toolbar">
						<text class="date-nav" @click="shiftSelectedRecordDate(-1)">前一天</text>
						<picker mode="date" :value="selectedRecordDate" @change="changeSelectedRecordDate">
							<view class="date-picker-value">{{ fullDateText }}</view>
						</picker>
						<text class="date-nav" @click="shiftSelectedRecordDate(1)">后一天</text>
						<text v-if="!selectedRecordIsToday" class="date-today" @click="resetSelectedRecordDate">今天</text>
					</view>
					<view v-if="!todayList.length && !todayLoading" class="empty">{{ todayEmptyText }}</view>
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
								<view :class="['record-dot', 'record-dot-' + record.type]">
									<uni-icons :type="recordIconType(record.type)" size="18" :color="recordIconColor(record.type)"></uni-icons>
								</view>
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

				<view v-else-if="activeTab === 'stats'" class="panel stats-panel">
					<view class="section-header compact-header">
						<view>
							<view class="section-title section-title-icon">
								<uni-icons type="bars" size="22" color="#2563eb"></uni-icons>
								<text>统计</text>
							</view>
							<view class="section-subtitle">周期汇总与最近 10 天走势</view>
						</view>
					</view>
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
							<view class="summary-label">
								<uni-icons type="download-filled" size="16" color="#12b76a"></uni-icons>
								<text>周期收入</text>
							</view>
							<strong>{{ formatMoney(summary.totals.periodIncome) }}</strong>
						</view>
						<view class="summary-card">
							<view class="summary-label">
								<uni-icons type="upload-filled" size="16" color="#c8171d"></uni-icons>
								<text>周期支出</text>
							</view>
							<strong class="danger-text">{{ formatMoney(summary.totals.periodExpense) }}</strong>
						</view>
						<view class="summary-card">
							<view class="summary-label">
								<uni-icons type="wallet-filled" size="16" color="#2563eb"></uni-icons>
								<text>周期存款</text>
							</view>
							<strong>{{ formatMoney(summary.totals.periodDeposit) }}</strong>
						</view>
						<view class="summary-card">
							<view class="summary-label">
								<uni-icons type="flag-filled" size="16" color="#f79009"></uni-icons>
								<text>周期净额</text>
							</view>
							<strong>{{ formatMoney(summary.totals.periodNet, true) }}</strong>
						</view>
					</view>
					<view class="chart-section">
						<view class="chart-header">
							<view>
								<view class="chart-title">最近 10 天收支</view>
								<view class="chart-subtitle">每天收入 / 支出双柱展示</view>
							</view>
							<view class="chart-pill">
								<uni-icons type="calendar" size="14" color="#2563eb"></uni-icons>
								<text>10天</text>
							</view>
						</view>
						<view v-if="dailyChartReady" class="daily-chart-card">
							<qiun-data-charts
								type="column"
								canvas-id="dailyTrendColumn"
								:canvas2d="true"
								:chartData="dailyChartData"
								:opts="dailyChartOpts"
								background="rgba(0,0,0,0)"
							></qiun-data-charts>
						</view>
						<view v-else class="empty chart-empty">最近 10 天暂无收入或支出记录。</view>
						<view class="daily-total-row">
							<view>
								<text>10天支出</text>
								<strong class="danger-text">{{ formatMoney(dailyExpenseTotal) }}</strong>
							</view>
							<view>
								<text>10天收入</text>
								<strong>{{ formatMoney(dailyIncomeTotal) }}</strong>
							</view>
						</view>
					</view>
					<view class="pie-section">
						<view class="chart-header">
							<view>
								<view class="chart-title">按记录名称占比</view>
								<view class="chart-subtitle">跟随当前统计周期</view>
							</view>
						</view>
						<view v-if="!nameStatsLegend.length" class="empty chart-empty">当前周期暂无记录。</view>
						<view v-else class="pie-layout">
							<canvas
								canvas-id="nameStatsPie"
								id="nameStatsPie"
								class="pie-canvas"
								:width="pieCanvasSize"
								:height="pieCanvasSize"
								:style="pieCanvasStyle"
							></canvas>
							<view class="pie-legend">
								<view v-for="item in nameStatsLegend" :key="item.key" class="legend-row">
									<view class="legend-main">
										<text class="legend-dot" :style="{ backgroundColor: item.color }"></text>
										<view class="legend-text">
											<view class="legend-name">{{ item.name }}</view>
											<view class="legend-meta">{{ recordTypeText(item.type) }} · {{ item.count }}笔</view>
										</view>
									</view>
									<view class="legend-side">
										<view>{{ formatMoney(item.amount) }}</view>
										<text>{{ item.percentText }}</text>
									</view>
								</view>
							</view>
						</view>
					</view>
				</view>

				<view v-else-if="activeTab === 'deposit'" class="panel">
					<view class="section-header">
						<view>
							<view class="section-title">存款</view>
							<view class="section-subtitle">存款记录</view>
						</view>
						<view class="header-actions">
							<view class="add-record-btn add-record-btn-blue" @click="openRecordForm('deposit')">
								<uni-icons type="wallet-filled" size="15" color="#ffffff"></uni-icons>
								<text>新建存款</text>
							</view>
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
								<view :class="['record-dot', 'record-dot-' + record.type]">
									<uni-icons :type="recordIconType(record.type)" size="18" :color="recordIconColor(record.type)"></uni-icons>
								</view>
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

				<view v-else class="panel">
					<view class="section-header">
						<view>
							<view class="section-title">人情收支</view>
							<view class="section-subtitle">总计 {{ formatMoney(humanSummary.net, true) }}</view>
						</view>
						<view class="header-actions">
							<view class="add-record-btn add-record-btn-amber" @click="openHumanRecordForm()">
								<uni-icons type="gift-filled" size="15" color="#ffffff"></uni-icons>
								<text>新建人情</text>
							</view>
						</view>
					</view>
					<view class="period-tabs">
						<text :class="{ active: humanSubTab === 'records' }" @click="humanSubTab = 'records'">收支记录</text>
						<text :class="{ active: humanSubTab === 'friends' }" @click="humanSubTab = 'friends'">朋友管理</text>
					</view>
					<view v-if="humanSubTab === 'records'">
						<view class="summary-grid">
							<view class="summary-card">
								<text>收礼总额</text>
								<strong>{{ formatMoney(humanSummary.income) }}</strong>
							</view>
							<view class="summary-card">
								<text>送礼总额</text>
								<strong class="danger-text">{{ formatMoney(humanSummary.expense) }}</strong>
							</view>
						</view>
						<view v-if="!humanRecords.length && !humanLoading" class="empty">还没有人情收支记录。</view>
						<view v-else-if="humanRecords.length" class="timeline">
							<uni-swipe-action>
								<uni-swipe-action-item
									v-for="record in humanRecords"
									:key="record._id"
									:right-options="recordActionOptions"
									@click="onHumanRecordActionClick($event, record)"
								>
									<view class="record-item">
										<view :class="['record-dot', record.type === 'human_expense' ? 'record-dot-expense' : 'record-dot-income', 'compact-dot']">
											<uni-icons type="gift-filled" size="17" :color="record.type === 'human_expense' ? '#c8171d' : '#12b76a'"></uni-icons>
										</view>
										<view class="record-main">
											<view class="record-name">{{ record.friend_name }}</view>
											<view class="record-note">{{ record.type === 'human_income' ? '收礼' : '送礼' }}{{ record.note ? ' · ' + record.note : '' }}</view>
										</view>
										<view class="record-side">
											<view :class="['record-amount', record.type === 'human_expense' ? 'danger-text' : '']">
												{{ record.type === 'human_expense' ? '-' : '+' }}{{ formatMoney(record.amount) }}
											</view>
											<view class="record-time">{{ shortDate(record.occurred_at) }}</view>
										</view>
									</view>
								</uni-swipe-action-item>
							</uni-swipe-action>
							<view v-if="humanHasMore" class="load-more" @click="fetchHumanRecords(false)">
								<text v-if="humanLoading">加载中…</text>
								<text v-else>加载更多（{{ humanRecords.length }}/{{ humanTotal }}）</text>
							</view>
						</view>
					</view>
					<view v-else>
						<view class="section-header">
							<view class="section-subtitle">点击朋友可查看全部收支明细</view>
							<view class="add-record-btn" @click="openFriendForm()">
								<uni-icons type="personadd-filled" size="15" color="#ffffff"></uni-icons>
								<text>新增朋友</text>
							</view>
						</view>
						<view v-if="!friends.length" class="empty">还没有朋友，先新增一个吧。</view>
						<view v-else class="timeline">
							<uni-swipe-action>
								<uni-swipe-action-item
									v-for="friend in friends"
									:key="friend._id"
									:right-options="recordActionOptions"
									@click="onFriendActionClick($event, friend)"
								>
									<view class="record-item friend-item" @click="openFriendDetail(friend)">
										<view class="record-dot compact-dot record-dot-friend">
											<uni-icons type="person-filled" size="17" color="#2563eb"></uni-icons>
										</view>
										<view class="record-main">
											<view class="record-name">{{ friend.name }}</view>
											<view class="record-note">{{ friend.note || '无备注' }}</view>
										</view>
										<view class="record-side">
											<view class="record-time">查看详情</view>
										</view>
									</view>
								</uni-swipe-action-item>
							</uni-swipe-action>
						</view>
					</view>
				</view>
			</scroll-view>

			<view class="bottom-tabbar">
				<view :class="['tab-item', activeTab === 'today' ? 'active' : '']" @click="switchTab('today')">
					<uni-icons type="calendar-filled" size="23" :color="activeTab === 'today' ? '#282321' : '#667085'"></uni-icons>
					<text>今日记录</text>
				</view>
				<view :class="['tab-item', activeTab === 'stats' ? 'active' : '']" @click="switchTab('stats')">
					<uni-icons type="bars" size="23" :color="activeTab === 'stats' ? '#282321' : '#667085'"></uni-icons>
					<text>统计</text>
				</view>
				<view :class="['tab-item', activeTab === 'deposit' ? 'active' : '']" @click="switchTab('deposit')">
					<uni-icons type="wallet-filled" size="23" :color="activeTab === 'deposit' ? '#282321' : '#667085'"></uni-icons>
					<text>存款</text>
				</view>
				<view :class="['tab-item', activeTab === 'human' ? 'active' : '']" @click="switchTab('human')">
					<uni-icons type="gift-filled" size="23" :color="activeTab === 'human' ? '#282321' : '#667085'"></uni-icons>
					<text>人情</text>
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
		<view v-if="showHumanRecordForm" class="modal-mask">
			<view class="modal">
				<view class="modal-title">{{ editingHumanRecordId ? '编辑人情记录' : '新建人情记录' }}</view>
				<view class="type-tabs">
					<text :class="{ active: humanRecordForm.type === 'human_income' }" @click="humanRecordForm.type = 'human_income'">收礼</text>
					<text :class="{ active: humanRecordForm.type === 'human_expense' }" @click="humanRecordForm.type = 'human_expense'">送礼</text>
				</view>
				<picker :range="friendPickerNames" :value="humanFriendPickerIndex" @change="onSelectHumanFriend">
					<view class="picker">{{ humanRecordForm.friendName || '请选择朋友' }}</view>
				</picker>
				<input class="input" type="digit" v-model="humanRecordForm.amount" placeholder="金额，如 200" />
				<picker mode="date" :value="humanRecordForm.occurredDate" @change="humanRecordForm.occurredDate = $event.detail.value">
					<view class="picker">{{ humanRecordForm.occurredDate }}</view>
				</picker>
				<picker mode="time" :value="humanRecordForm.occurredTime" @change="humanRecordForm.occurredTime = $event.detail.value">
					<view class="picker">{{ humanRecordForm.occurredTime }}</view>
				</picker>
				<input class="input" v-model="humanRecordForm.note" placeholder="备注，可不填" />
				<view class="modal-actions">
					<button @click="showHumanRecordForm = false">取消</button>
					<button class="primary-btn" :loading="submitting" @click="submitHumanRecord">保存</button>
				</view>
			</view>
		</view>
		<view v-if="showFriendForm" class="modal-mask">
			<view class="modal">
				<view class="modal-title">{{ editingFriendId ? '编辑朋友' : '新增朋友' }}</view>
				<input class="input" v-model="friendForm.name" placeholder="朋友姓名" />
				<input class="input" v-model="friendForm.note" placeholder="备注，可不填" />
				<view class="modal-actions">
					<button @click="showFriendForm = false">取消</button>
					<button class="primary-btn" :loading="submitting" @click="submitFriend">保存</button>
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
			selectedRecordDate: '',
			summary: this.getEmptySummary(),
			todaySummary: this.getEmptySummary(),
			dailyStats: [],
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
			humanSubTab: 'records',
			humanSummary: { income: 0, expense: 0, net: 0 },
			humanRecords: [],
			humanPage: 1,
			humanTotal: 0,
			humanHasMore: false,
			humanLoading: false,
			friends: [],
			refreshing: false,
			editingRecordId: '',
			editingHumanRecordId: '',
			editingFriendId: '',
			recordActionOptions: [
				{ text: '编辑', style: { backgroundColor: '#282321' } },
				{ text: '删除', style: { backgroundColor: '#c8171d' } }
			],
			showRecordForm: false,
			showHumanRecordForm: false,
			showFriendForm: false,
			recordForm: {
				type: 'expense',
				name: '',
				amount: '',
				note: '',
				occurredDate: '',
				occurredTime: ''
			},
			humanRecordForm: {
				type: 'human_expense',
				friendId: '',
				friendName: '',
				amount: '',
				note: '',
				occurredDate: '',
				occurredTime: ''
			},
			friendForm: {
				name: '',
				note: ''
			},
			pieCanvasSize: 180,
			pieColors: ['#282321', '#c8171d', '#2f80ed', '#12b76a', '#f79009', '#7a5af8', '#0e9384', '#f63d68', '#98a2b3'],
			dailyChartOpts: {
				color: ['#c8171d', '#12b76a'],
				padding: [10, 10, 0, 0],
				enableScroll: false,
				legend: {
					show: true,
					position: 'top',
					float: 'right',
					margin: 8
				},
				xAxis: {
					disableGrid: true,
					fontColor: '#667085',
					fontSize: 10
				},
				yAxis: {
					gridType: 'dash',
					dashLength: 3,
					data: [{ min: 0, fontColor: '#98a2b3' }]
				},
				extra: {
					column: {
						type: 'group',
						width: 12,
						activeBgColor: '#101828',
						activeBgOpacity: 0.06
					}
				}
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
			const date = this.parseDateInput(this.selectedRecordDate);
			return `${String(date.getDate()).padStart(2, '0')}日`;
		},
		fullDateText() {
			const date = this.parseDateInput(this.selectedRecordDate);
			return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
		},
		selectedRecordIsToday() {
			return this.selectedRecordDate === this.formatDateInput(Date.now());
		},
		todayEmptyText() {
			return this.selectedRecordIsToday ? '今天还没有记录，点“+ 新建”记一笔。' : '这天还没有记录，点“+ 新建”补一笔。';
		},
		todayProfitLoss() {
			const t = this.todaySummary && this.todaySummary.totals;
			if (!t) return 0;
			return (t.periodIncome || 0) - (t.periodExpense || 0);
		},
		statRangeLabel() {
			const range = this.getPeriodRange(this.statPeriod);
			return `${this.formatDateText(range.startAt)} 至 ${this.formatDateText(range.endAt - 1)}`;
		},
		nameStats() {
			return (this.summary && this.summary.nameStats) || [];
		},
		nameStatsLegend() {
			const total = this.nameStats.reduce((sum, item) => sum + Number(item.amount || 0), 0);
			if (!total) return [];
			return this.nameStats.map((item, index) => {
				const amount = Number(item.amount || 0);
				const percent = amount / total;
				return {
					...item,
					color: this.pieColors[index % this.pieColors.length],
					percentText: `${(percent * 100).toFixed(percent >= 0.1 ? 0 : 1)}%`
				};
			});
		},
		dailyChartData() {
			return {
				categories: this.dailyStats.map((item) => item.label),
				series: [
					{
						name: '支出',
						data: this.dailyStats.map((item) => this.centsToYuan(item.expense))
					},
					{
						name: '收入',
						data: this.dailyStats.map((item) => this.centsToYuan(item.income))
					}
				]
			};
		},
		dailyChartReady() {
			return this.dailyStats.some((item) => Number(item.income || 0) > 0 || Number(item.expense || 0) > 0);
		},
		dailyExpenseTotal() {
			return this.dailyStats.reduce((sum, item) => sum + Number(item.expense || 0), 0);
		},
		dailyIncomeTotal() {
			return this.dailyStats.reduce((sum, item) => sum + Number(item.income || 0), 0);
		},
		pieCanvasStyle() {
			return `width: ${this.pieCanvasSize}px; height: ${this.pieCanvasSize}px;`;
		},
		friendPickerNames() {
			return this.friends.map((item) => item.name);
		},
		humanFriendPickerIndex() {
			if (!this.humanRecordForm.friendId) return 0;
			const idx = this.friends.findIndex((item) => item._id === this.humanRecordForm.friendId);
			return idx < 0 ? 0 : idx;
		}
	},
	onLoad() {
		this.selectedRecordDate = this.formatDateInput(Date.now());
		this.recordForm.occurredDate = this.formatDateInput(Date.now());
		this.recordForm.occurredTime = this.formatTimeInput(Date.now());
		this.humanRecordForm.occurredDate = this.formatDateInput(Date.now());
		this.humanRecordForm.occurredTime = this.formatTimeInput(Date.now());
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
				},
				nameStats: []
			};
		},
		normalizeSummary(data = {}) {
			const empty = this.getEmptySummary();
			return {
				totals: {
					...empty.totals,
					...(data.totals || {})
				},
				nameStats: Array.isArray(data.nameStats) ? data.nameStats : []
			};
		},
		normalizeDailyStats(rows = [], days = []) {
			const rowMap = rows.reduce((map, item) => {
				map[item.key] = item;
				return map;
			}, {});
			return days.map((day) => {
				const row = rowMap[day.key] || {};
				return {
					...day,
					income: Number(row.income || 0),
					expense: Number(row.expense || 0)
				};
			});
		},
		getLastTenDayRanges() {
			const today = this.parseDateInput(Date.now());
			const days = [];
			for (let i = 9; i >= 0; i -= 1) {
				const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
				const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
				days.push({
					key: this.formatDateInput(start.getTime()),
					label: `${start.getMonth() + 1}/${start.getDate()}`,
					startAt: start.getTime(),
					endAt: end.getTime()
				});
			}
			return days;
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
		centsToYuan(cents) {
			return Number((Number(cents || 0) / 100).toFixed(2));
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
			const dayRange = this.getSelectedRecordDayRange();
			const dailyDays = this.getLastTenDayRanges();
			const [summaryData, todaySummaryData, dailyData] = await Promise.all([
				this.callMoney('getSummary', { ...range, includeNameStats: true }),
				this.callMoney('getSummary', dayRange),
				this.callMoney('getDailyStats', { days: dailyDays })
			]);
			this.summary = this.normalizeSummary(summaryData);
			this.todaySummary = this.normalizeSummary(todaySummaryData);
			this.dailyStats = this.normalizeDailyStats(dailyData.days || [], dailyDays);
			this.$nextTick(() => this.drawNameStatsPie());
		},
		async loadAll() {
			try {
				await this.loadSummary();
				await Promise.all([
					this.fetchTodayRecords(true),
					this.fetchDepositRecords(true),
					this.fetchHumanRecords(true),
					this.loadFriends(),
					this.loadHumanSummary()
				]);
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			}
		},
		async loadHumanSummary() {
			const data = await this.callMoney('getHumanSummary');
			this.humanSummary = data.totals || { income: 0, expense: 0, net: 0 };
		},
		async loadFriends() {
			const data = await this.callMoney('listFriends');
			this.friends = data.friends || [];
		},
		async fetchHumanRecords(reset, friendId = '') {
			if (this.humanLoading) return;
			if (reset) {
				this.humanPage = 1;
				this.humanRecords = [];
				this.humanHasMore = false;
				this.humanTotal = 0;
			} else if (!this.humanHasMore) {
				return;
			}
			const page = reset ? 1 : this.humanPage + 1;
			this.humanLoading = true;
			try {
				const data = await this.callMoney('listHumanRecords', { page, pageSize: 10, friendId });
				const list = this.sortRecordsByTime(data.records || []);
				this.humanRecords = this.sortRecordsByTime(reset ? list : this.humanRecords.concat(list));
				this.humanPage = data.page;
				this.humanTotal = data.total;
				this.humanHasMore = !!data.hasMore;
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.humanLoading = false;
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
				const range = this.getSelectedRecordDayRange();
				const data = await this.callMoney('listRecords', {
					types: ['income', 'expense'],
					startAt: range.startAt,
					endAt: range.endAt,
					page,
					pageSize: 10
				});
				const list = this.sortRecordsByTime(data.records || []);
				this.todayList = this.sortRecordsByTime(reset ? list : this.todayList.concat(list));
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
				const list = this.sortRecordsByTime(data.records || []);
				this.depositList = this.sortRecordsByTime(reset ? list : this.depositList.concat(list));
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
				occurredDate: type === 'deposit' ? this.formatDateInput(Date.now()) : (this.selectedRecordDate || this.formatDateInput(Date.now())),
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
		async onHumanRecordActionClick(e, record) {
			const idx = Number(e && e.index);
			if (idx === 0) return this.openHumanRecordForm(record);
			if (idx === 1) return this.removeHumanRecord(record);
		},
		async onFriendActionClick(e, friend) {
			const idx = Number(e && e.index);
			if (idx === 0) return this.openFriendForm(friend);
			if (idx === 1) return this.removeFriend(friend);
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
		openHumanRecordForm(record = null) {
			const nowTs = Date.now();
			if (record && record._id) {
				this.editingHumanRecordId = record._id;
				this.humanRecordForm = {
					type: record.type,
					friendId: record.friend_id || '',
					friendName: record.friend_name || '',
					amount: ((Number(record.amount || 0)) / 100).toString(),
					note: record.note || '',
					occurredDate: this.formatDateInput(record.occurred_at || nowTs),
					occurredTime: this.formatTimeInput(record.occurred_at || nowTs)
				};
			} else {
				this.editingHumanRecordId = '';
				this.humanRecordForm = {
					type: 'human_expense',
					friendId: '',
					friendName: '',
					amount: '',
					note: '',
					occurredDate: this.formatDateInput(nowTs),
					occurredTime: this.formatTimeInput(nowTs)
				};
			}
			this.showHumanRecordForm = true;
		},
		onSelectHumanFriend(e) {
			const index = Number(e.detail.value || 0);
			const friend = this.friends[index];
			if (!friend) return;
			this.humanRecordForm.friendId = friend._id;
			this.humanRecordForm.friendName = friend.name;
		},
		async submitHumanRecord() {
			if (!this.humanRecordForm.friendId) return uni.showToast({ title: '请选择朋友', icon: 'none' });
			if (!this.humanRecordForm.amount) return uni.showToast({ title: '请输入金额', icon: 'none' });
			this.submitting = true;
			try {
				const payload = {
					friendId: this.humanRecordForm.friendId,
					friendName: this.humanRecordForm.friendName,
					type: this.humanRecordForm.type,
					amount: this.humanRecordForm.amount,
					note: this.humanRecordForm.note,
					occurredAt: this.getTimestampByDateTime(this.humanRecordForm.occurredDate, this.humanRecordForm.occurredTime)
				};
				if (this.editingHumanRecordId) {
					await this.callMoney('updateHumanRecord', { id: this.editingHumanRecordId, ...payload });
				} else {
					await this.callMoney('createHumanRecord', payload);
				}
				this.showHumanRecordForm = false;
				this.editingHumanRecordId = '';
				await Promise.all([this.fetchHumanRecords(true), this.loadHumanSummary()]);
				uni.showToast({ title: '已保存', icon: 'success' });
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.submitting = false;
			}
		},
		async removeHumanRecord(record) {
			const that = this;
			uni.showModal({
				title: '删除记录',
				content: `确认删除与「${record.friend_name || ''}」的这条记录吗？`,
				success: async (res) => {
					if (!res.confirm) return;
					try {
						await that.callMoney('deleteHumanRecord', { id: record._id });
						await Promise.all([that.fetchHumanRecords(true), that.loadHumanSummary()]);
						uni.showToast({ title: '已删除', icon: 'success' });
					} catch (e) {
						uni.showToast({ title: e.message, icon: 'none' });
					}
				}
			});
		},
		openFriendForm(friend = null) {
			if (friend && friend._id) {
				this.editingFriendId = friend._id;
				this.friendForm = { name: friend.name || '', note: friend.note || '' };
			} else {
				this.editingFriendId = '';
				this.friendForm = { name: '', note: '' };
			}
			this.showFriendForm = true;
		},
		async submitFriend() {
			if (!this.friendForm.name.trim()) return uni.showToast({ title: '请输入朋友名称', icon: 'none' });
			this.submitting = true;
			try {
				await this.callMoney('upsertFriend', {
					id: this.editingFriendId,
					name: this.friendForm.name,
					note: this.friendForm.note
				});
				this.showFriendForm = false;
				this.editingFriendId = '';
				await this.loadFriends();
				uni.showToast({ title: '已保存', icon: 'success' });
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.submitting = false;
			}
		},
		async removeFriend(friend) {
			const that = this;
			uni.showModal({
				title: '删除朋友',
				content: `确认删除朋友「${friend.name}」吗？`,
				success: async (res) => {
					if (!res.confirm) return;
					try {
						await that.callMoney('deleteFriend', { id: friend._id });
						await that.loadFriends();
						uni.showToast({ title: '已删除', icon: 'success' });
					} catch (e) {
						uni.showToast({ title: e.message, icon: 'none' });
					}
				}
			});
		},
		openFriendDetail(friend) {
			uni.navigateTo({
				url: `/pages/money/friend?friendId=${encodeURIComponent(friend._id)}&friendName=${encodeURIComponent(friend.name)}`
			});
		},
		switchTab(tab) {
			this.activeTab = tab;
			if (tab === 'stats') {
				this.$nextTick(() => this.drawNameStatsPie());
			}
		},
		async changeSelectedRecordDate(e) {
			const value = e && e.detail ? e.detail.value : '';
			if (!value || value === this.selectedRecordDate) return;
			await this.setSelectedRecordDate(value);
		},
		async shiftSelectedRecordDate(offset) {
			const date = this.parseDateInput(this.selectedRecordDate);
			date.setDate(date.getDate() + offset);
			await this.setSelectedRecordDate(this.formatDateInput(date.getTime()));
		},
		async resetSelectedRecordDate() {
			await this.setSelectedRecordDate(this.formatDateInput(Date.now()));
		},
		async setSelectedRecordDate(dateStr) {
			this.selectedRecordDate = this.formatDateInput(this.parseDateInput(dateStr).getTime());
			try {
				await Promise.all([this.loadSummary(), this.fetchTodayRecords(true)]);
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			}
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
		parseDateInput(value) {
			if (typeof value === 'string') {
				const parts = value.split('-').map(Number);
				if (parts.length === 3 && parts.every((item) => Number.isFinite(item))) {
					const parsed = new Date(parts[0], parts[1] - 1, parts[2]);
					if (Number.isFinite(parsed.getTime())) return parsed;
				}
			}
			const source = value === undefined || value === null || value === '' ? Date.now() : value;
			const date = new Date(source);
			if (!Number.isFinite(date.getTime())) return new Date();
			return new Date(date.getFullYear(), date.getMonth(), date.getDate());
		},
		getSelectedRecordDayRange() {
			const start = this.parseDateInput(this.selectedRecordDate);
			const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
			return { startAt: start.getTime(), endAt: end.getTime() };
		},
		getPeriodRange(period, baseValue = Date.now()) {
			const now = this.parseDateInput(baseValue);
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
		drawNameStatsPie() {
			if (this.activeTab !== 'stats') return;
			const ctx = uni.createCanvasContext('nameStatsPie', this);
			if (!ctx) return;

			const size = this.pieCanvasSize;
			const center = size / 2;
			const radius = center - 6;
			const stats = this.nameStatsLegend.filter((item) => Number(item.amount || 0) > 0);
			const total = stats.reduce((sum, item) => sum + Number(item.amount || 0), 0);

			ctx.clearRect(0, 0, size, size);
			if (!stats.length || !total) {
				ctx.draw();
				return;
			}

			let startAngle = -Math.PI / 2;
			stats.forEach((item, index) => {
				const amount = Number(item.amount || 0);
				const angle = index === stats.length - 1 ? Math.max(0, Math.PI * 1.5 - startAngle) : (amount / total) * Math.PI * 2;
				const endAngle = startAngle + angle;
				ctx.beginPath();
				ctx.moveTo(center, center);
				ctx.arc(center, center, radius, startAngle, endAngle);
				ctx.closePath();
				ctx.setFillStyle(item.color);
				ctx.fill();
				ctx.setLineWidth(2);
				ctx.setStrokeStyle('#ffffff');
				ctx.stroke();
				startAngle = endAngle;
			});
			ctx.draw();
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
		getTimestampByDateTime(dateStr, timeStr) {
			const d = dateStr || this.formatDateInput(Date.now());
			const t = timeStr || this.formatTimeInput(Date.now());
			const [year, month, day] = d.split('-').map(Number);
			const [hour, minute] = t.split(':').map(Number);
			const h = Number.isFinite(hour) ? hour : new Date().getHours();
			const min = Number.isFinite(minute) ? minute : new Date().getMinutes();
			const ts = new Date(year, month - 1, day, h, min, 0, 0).getTime();
			return Number.isFinite(ts) ? ts : Date.now();
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
			return { income: '收入', expense: '支出', deposit: '存款', other: '合并' }[type] || '记录';
		},
		recordIconType(type) {
			return { income: 'download-filled', expense: 'upload-filled', deposit: 'wallet-filled' }[type] || 'compose';
		},
		recordIconColor(type) {
			return { income: '#12b76a', expense: '#c8171d', deposit: '#2563eb' }[type] || '#667085';
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
	background: #f5f7fb;
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
	background: #eef5ff;
}

.auth-card,
.panel,
.modal {
	background: #ffffff;
	border-radius: 16rpx;
	box-shadow: 0 18rpx 48rpx rgba(16, 24, 40, 0.08);
}

.auth-card {
	width: 100%;
	max-width: 640rpx;
	padding: 48rpx 36rpx;
}

.brand {
	color: #2563eb;
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
	background: #2563eb;
	color: #ffffff;
	border-radius: 16rpx;
}

.app-shell {
	min-height: 100vh;
}

.content {
	height: 100vh;
	padding: 18rpx 18rpx 160rpx;
	box-sizing: border-box;
}

.hero-card {
	position: relative;
	overflow: hidden;
	padding: 30rpx 32rpx;
	border-radius: 16rpx;
	background: linear-gradient(135deg, #172554 0%, #2563eb 56%, #12b76a 100%);
	color: #ffffff;
	box-shadow: 0 18rpx 42rpx rgba(37, 99, 235, 0.24);
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

.hero-top,
.hero-date,
.hero-metrics,
.summary-label,
.section-title-icon,
.refresh,
.add-record-btn,
.chart-pill,
.daily-total-row {
	display: flex;
	align-items: center;
}

.hero-top {
	position: relative;
	z-index: 1;
	justify-content: space-between;
	gap: 20rpx;
}

.hero-date {
	gap: 10rpx;
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
	position: relative;
	z-index: 1;
}

.hero-profit-loss {
	color: #fecaca;
}

.hero-chip {
	position: relative;
	z-index: 1;
	padding: 10rpx 18rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.18);
	font-size: 24rpx;
	font-weight: 700;
}

.hero-metrics {
	position: relative;
	z-index: 1;
	gap: 16rpx;
	margin-top: 26rpx;
}

.hero-metrics view {
	flex: 1;
	padding: 18rpx 20rpx;
	border-radius: 16rpx;
	background: rgba(255, 255, 255, 0.14);
}

.hero-metrics text {
	display: block;
	color: rgba(255, 255, 255, 0.72);
	font-size: 22rpx;
}

.hero-metrics strong {
	display: block;
	margin-top: 8rpx;
	font-size: 30rpx;
}

.panel {
	margin-top: 22rpx;
	padding: 28rpx;
	box-shadow: 0 12rpx 32rpx rgba(16, 24, 40, 0.06);
}

.section-title {
	font-size: 32rpx;
	font-weight: 800;
	margin-bottom: 18rpx;
}

.section-title-icon {
	gap: 10rpx;
}

.compact-header {
	margin-bottom: 22rpx;
}

.refresh {
	gap: 6rpx;
	color: #667085;
	font-size: 24rpx;
}

.header-actions {
	display: flex;
	align-items: center;
	gap: 18rpx;
}

.date-toolbar {
	display: flex;
	align-items: center;
	gap: 12rpx;
	margin: 22rpx 0 8rpx;
	flex-wrap: wrap;
}

.date-nav,
.date-today,
.date-picker-value {
	min-height: 62rpx;
	line-height: 62rpx;
	padding: 0 20rpx;
	border-radius: 18rpx;
	background: #f2f4f7;
	color: #667085;
	font-size: 24rpx;
	box-sizing: border-box;
}

.date-picker-value {
	min-width: 220rpx;
	text-align: center;
	background: #2563eb;
	color: #ffffff;
	font-weight: 700;
}

.date-today {
	background: #fff7ed;
	color: #c2410c;
}

.add-record-btn {
	gap: 6rpx;
	padding: 12rpx 22rpx;
	border-radius: 999rpx;
	background: #282321;
	color: #ffffff;
	font-size: 24rpx;
}

.add-record-btn-blue {
	background: #2563eb;
}

.add-record-btn-amber {
	background: #f79009;
}

.summary-strip {
	gap: 16rpx;
	margin: 24rpx 0;
}

.summary-strip view {
	flex: 1;
	padding: 22rpx;
	border-radius: 16rpx;
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
	border-radius: 16rpx;
	background: #f8fafc;
	border: 1px solid #edf2f7;
}

.summary-label {
	gap: 8rpx;
}

.pie-section {
	margin-top: 28rpx;
	padding-top: 26rpx;
	border-top: 1px solid #f0f0f0;
}

.chart-section {
	margin-top: 28rpx;
	padding: 24rpx;
	border-radius: 16rpx;
	background: #f8fafc;
	border: 1px solid #edf2f7;
}

.chart-header {
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: 16rpx;
	margin-bottom: 20rpx;
}

.chart-title {
	font-size: 30rpx;
	font-weight: 800;
}

.chart-subtitle,
.legend-meta,
.legend-side text {
	color: #667085;
	font-size: 22rpx;
}

.chart-empty {
	padding: 40rpx 0 22rpx;
}

.chart-pill {
	flex-shrink: 0;
	gap: 6rpx;
	padding: 8rpx 16rpx;
	border-radius: 999rpx;
	background: #eff6ff;
	color: #2563eb;
	font-size: 22rpx;
}

.daily-chart-card {
	height: 360rpx;
	margin-top: 8rpx;
}

.daily-total-row {
	gap: 16rpx;
	margin-top: 20rpx;
}

.daily-total-row view {
	flex: 1;
	padding: 18rpx;
	border-radius: 16rpx;
	background: #ffffff;
	border: 1px solid #edf2f7;
}

.daily-total-row text {
	color: #667085;
	font-size: 22rpx;
}

.daily-total-row strong {
	display: block;
	margin-top: 8rpx;
	font-size: 28rpx;
}

.pie-layout {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 22rpx;
}

.pie-canvas {
	display: block;
	flex-shrink: 0;
}

.pie-legend {
	width: 100%;
}

.legend-row,
.legend-main {
	display: flex;
	align-items: center;
}

.legend-row {
	justify-content: space-between;
	gap: 18rpx;
	min-height: 72rpx;
	border-bottom: 1px solid #f5f5f5;
}

.legend-main {
	flex: 1;
	min-width: 0;
	gap: 14rpx;
}

.legend-dot {
	display: block;
	width: 18rpx;
	height: 18rpx;
	border-radius: 50%;
	flex-shrink: 0;
}

.legend-text {
	min-width: 0;
}

.legend-name {
	font-size: 26rpx;
	font-weight: 700;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.legend-side {
	text-align: right;
	font-size: 24rpx;
	font-weight: 700;
	flex-shrink: 0;
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
	background: #2563eb;
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
	gap: 16rpx;
}

.friend-item {
	padding-left: 12rpx;
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

.record-dot-income {
	background: #ecfdf3;
	border-color: #abefc6;
}

.record-dot-expense {
	background: #fff1f3;
	border-color: #fecdd6;
}

.record-dot-deposit,
.record-dot-friend {
	background: #eff6ff;
	border-color: #bfdbfe;
}

.compact-dot {
	width: 64rpx;
	height: 64rpx;
	flex-shrink: 0;
}

.record-main {
	flex: 1;
	min-width: 0;
}

.record-name {
	font-size: 30rpx;
	font-weight: 700;
}

.record-side {
	text-align: right;
	flex-shrink: 0;
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
	flex: 1;
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
