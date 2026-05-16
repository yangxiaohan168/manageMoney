<template>
	<view class="page">
		<view v-if="loading" class="loading">加载中...</view>

		<view v-else-if="!authenticated" class="auth-page">
			<view class="auth-card">
				<view class="brand">一起存钱</view>
				<view class="auth-title">{{ hasPassword ? '输入管理密码' : '首次设置管理密码' }}</view>
				<view class="auth-desc">
					{{ hasPassword ? '本机缓存验证通过后可直接进入。' : '密码会加密存入云数据库，用于保护账本。' }}
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
				:show-scrollbar="false"
				:refresher-enabled="true"
				:refresher-triggered="refreshing"
				@refresherrefresh="handleRefresh"
			>
				<view v-if="activeTab === 'month'" class="hero-card">
					<view class="hero-top">
						<view>
							<picker mode="date" fields="month" :value="selectedCycleMonth" @change="changeSelectedCycleMonth">
								<view class="hero-date hero-date-action">
									<uni-icons type="calendar-filled" size="19" color="#ffffff"></uni-icons>
									<text>{{ cycleTitle }}</text>
								</view>
							</picker>
							<view class="hero-profit-label">{{ cycleRangeLabel }}</view>
						</view>
						<picker mode="selector" :range="cycleStartDayOptions" :value="cycleStartDay - 1" @change="changeCycleStartDay">
							<view class="hero-chip">{{ cycleStartDay }}号起</view>
						</picker>
					</view>
					<view :class="['hero-profit-amount', cycleNet < 0 ? 'hero-profit-loss' : '']">
						<text>{{ formatMoney(cycleNet, true) }}</text>
						<text v-if="periodAdvance > 0" class="advance-minus">-{{ formatMoney(periodAdvance) }}</text>
						<text v-if="periodAdvance > 0" :class="['advance-after', advanceAfterToneClass]">= {{ formatMoney(cycleNetAfterAdvance, true) }}</text>
					</view>
					<view class="hero-metrics">
						<view>
							<text>收入</text>
							<strong>{{ formatMoney(summary.totals.periodIncome) }}</strong>
						</view>
						<view>
							<text>支出</text>
							<strong>{{ formatMoney(summary.totals.periodExpense) }}</strong>
						</view>
					</view>
				</view>

				<view v-if="activeTab === 'month'" class="panel">
					<view class="section-header">
						<view>
							<view class="section-title">月账明细</view>
							<view class="section-subtitle">普通收支、存款和人情收支合并展示</view>
						</view>
						<view class="header-actions">
							<view class="refresh" @click="loadAll">
								<uni-icons type="refresh" size="15" color="#667085"></uni-icons>
								<text>刷新</text>
							</view>
							<view class="add-record-btn" @click="openRecordForm('expense')">
								<uni-icons type="plus" size="15" color="#ffffff"></uni-icons>
								<text>支出</text>
							</view>
							<view class="add-record-btn add-record-btn-green" @click="openRecordForm('income')">
								<uni-icons type="download-filled" size="15" color="#ffffff"></uni-icons>
								<text>收入</text>
							</view>
							<view class="add-record-btn add-record-btn-muted" @click="openRecordForm('advance')">
								<uni-icons type="compose" size="15" color="#ffffff"></uni-icons>
								<text>预支</text>
							</view>
						</view>
					</view>

					<view class="detail-tabs">
						<text :class="{ active: monthlySubTab === 'regular' }" @click="switchMonthlySubTab('regular')">收支明细</text>
						<text :class="{ active: monthlySubTab === 'advance' }" @click="switchMonthlySubTab('advance')">预支明细</text>
					</view>

					<view v-if="monthlySubTab === 'regular' && !monthlyEntries.length && !monthlyLoading" class="empty">这个周期还没有收支记录。</view>
					<view v-else-if="monthlySubTab === 'regular' && monthlyEntries.length" class="timeline">
						<uni-swipe-action>
							<uni-swipe-action-item
								v-for="(entry, index) in monthlyEntries"
								:key="entry.source + '-' + entry._id"
								:right-options="recordActionOptions"
								@click="onMonthlyEntryActionClick($event, entry)"
							>
								<view class="record-item">
									<view class="record-node">
										<view v-if="index !== 0" class="node-line top-line"></view>
										<view :class="['record-dot', entryToneClass(entry)]">
											<uni-icons :type="entryIconType(entry)" size="18" :color="entryIconColor(entry)"></uni-icons>
										</view>
										<view v-if="index !== monthlyEntries.length - 1" class="node-line bottom-line"></view>
									</view>
									<view class="record-main">
										<view class="record-name">{{ entryDisplayName(entry) }}</view>
										<view class="record-note">{{ entryTypeText(entry) }}{{ entry.note ? ' · ' + entry.note : '' }}</view>
									</view>
									<view class="record-side">
										<view :class="['record-amount', isExpenseEntry(entry) ? 'danger-text' : '']">
											{{ entryAmountText(entry) }}
										</view>
										<view class="record-time">{{ shortDate(entry.occurred_at) }}</view>
									</view>
								</view>
							</uni-swipe-action-item>
						</uni-swipe-action>
						<view v-if="monthlyHasMore" class="load-more" @click="fetchMonthlyEntries(false)">
							<text v-if="monthlyLoading">加载中...</text>
							<text v-else>加载更多（{{ monthlyEntries.length }}/{{ monthlyTotal }}）</text>
						</view>
					</view>
					<view v-else-if="monthlySubTab === 'regular' && monthlyLoading" class="empty">加载中...</view>

					<view v-if="monthlySubTab === 'advance' && !advanceEntries.length && !advanceLoading" class="empty">这个周期还没有预支记录。</view>
					<view v-else-if="monthlySubTab === 'advance' && advanceEntries.length" class="timeline">
						<uni-swipe-action>
							<uni-swipe-action-item
								v-for="(entry, index) in advanceEntries"
								:key="'advance-' + entry._id"
								:right-options="advanceActionOptions"
								@click="onAdvanceActionClick($event, entry)"
							>
								<view class="record-item">
									<view class="record-node">
										<view v-if="index !== 0" class="node-line top-line"></view>
										<view class="record-dot record-dot-advance">
											<uni-icons type="compose" size="18" color="#667085"></uni-icons>
										</view>
										<view v-if="index !== advanceEntries.length - 1" class="node-line bottom-line"></view>
									</view>
									<view class="record-main">
										<view class="record-name">{{ entryDisplayName(entry) }}</view>
										<view class="record-note">预支{{ entry.note ? ' · ' + entry.note : '' }}</view>
									</view>
									<view class="record-side">
										<view class="record-amount advance-text">-{{ formatMoney(entry.amount) }}</view>
										<view class="record-time">{{ shortDate(entry.occurred_at) }}</view>
									</view>
								</view>
							</uni-swipe-action-item>
						</uni-swipe-action>
						<view v-if="advanceHasMore" class="load-more" @click="fetchAdvanceEntries(false)">
							<text v-if="advanceLoading">加载中...</text>
							<text v-else>加载更多（{{ advanceEntries.length }}/{{ advanceTotal }}）</text>
						</view>
					</view>
					<view v-else-if="monthlySubTab === 'advance' && advanceLoading" class="empty">加载中...</view>
				</view>

				<view v-else-if="activeTab === 'stats'" class="panel stats-panel">
					<view class="section-header compact-header">
						<view>
							<view class="section-title section-title-icon">
								<uni-icons type="bars" size="22" color="#2563eb"></uni-icons>
								<text>月统计</text>
							</view>
							<view class="section-subtitle">{{ cycleRangeLabel }}</view>
						</view>
						<picker mode="date" fields="month" :value="selectedCycleMonth" @change="changeSelectedCycleMonth">
							<view class="stats-month-pill">{{ cycleTitle }}</view>
						</picker>
					</view>

					<view class="summary-grid">
						<view class="summary-card">
							<view class="summary-label">
								<uni-icons type="download-filled" size="16" color="#12b76a"></uni-icons>
								<text>月收入</text>
							</view>
							<strong>{{ formatMoney(summary.totals.periodIncome) }}</strong>
						</view>
						<view class="summary-card">
							<view class="summary-label">
								<uni-icons type="upload-filled" size="16" color="#c8171d"></uni-icons>
								<text>月支出</text>
							</view>
							<strong class="danger-text">{{ formatMoney(summary.totals.periodExpense) }}</strong>
						</view>
						<view class="summary-card">
							<view class="summary-label">
								<uni-icons type="flag-filled" size="16" color="#f79009"></uni-icons>
								<text>剩余经费</text>
							</view>
							<strong>
								{{ formatMoney(cycleNet, true) }}
								<text v-if="periodAdvance > 0" class="summary-advance-minus">-{{ formatMoney(periodAdvance) }}</text>
								<text v-if="periodAdvance > 0" :class="['summary-advance-after', advanceAfterToneClass]">= {{ formatMoney(cycleNetAfterAdvance, true) }}</text>
							</strong>
						</view>
					</view>

					<view class="chart-section">
						<view class="chart-header">
							<view>
								<view class="chart-title">最近5个月存款</view>
								<view class="chart-subtitle">按工资周期统计存款记录</view>
							</view>
						</view>
						<view v-if="monthlyDepositChartReady" class="daily-chart-card">
							<qiun-data-charts
								type="column"
								canvas-id="monthlyDepositColumn"
								:canvas2d="true"
								:chartData="monthlyDepositChartData"
								:opts="depositChartOpts"
								background="rgba(0,0,0,0)"
							></qiun-data-charts>
						</view>
						<view v-else class="empty chart-empty">最近5个周期暂无存款记录。</view>
					</view>

					<view class="chart-section">
						<view class="chart-header">
							<view>
								<view class="chart-title">最近5天支出</view>
								<view class="chart-subtitle">包含普通支出、存款和人情送礼</view>
							</view>
						</view>
						<view v-if="recentExpenseChartReady" class="daily-chart-card">
							<qiun-data-charts
								type="column"
								canvas-id="recentExpenseColumn"
								:canvas2d="true"
								:chartData="recentExpenseChartData"
								:opts="expenseChartOpts"
								background="rgba(0,0,0,0)"
							></qiun-data-charts>
						</view>
						<view v-else class="empty chart-empty">最近5天暂无支出记录。</view>
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
							<text>累计存款</text>
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
										<view class="record-dot record-dot-deposit">
											<uni-icons type="wallet-filled" size="18" color="#2563eb"></uni-icons>
										</view>
										<view v-if="index !== depositList.length - 1" class="node-line bottom-line"></view>
									</view>
									<view class="record-main">
										<view class="record-name">{{ recordDisplayName(record) }}</view>
										<view class="record-note">存款{{ record.note ? ' · ' + record.note : '' }}</view>
									</view>
									<view class="record-side">
										<view class="record-amount danger-text">+{{ formatMoney(record.amount) }}</view>
										<view class="record-time">{{ shortDate(record.occurred_at) }}</view>
									</view>
								</view>
							</uni-swipe-action-item>
						</uni-swipe-action>
						<view v-if="depositHasMore" class="load-more" @click="fetchDepositRecords(false)">
							<text v-if="depositLoading">加载中...</text>
							<text v-else>加载更多（{{ depositList.length }}/{{ depositTotal }}）</text>
						</view>
					</view>
					<view v-else-if="depositLoading" class="empty">加载中...</view>
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
								<text>新人情</text>
							</view>
						</view>
					</view>
					<view class="detail-tabs human-tabs">
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
								<text v-if="humanLoading">加载中...</text>
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
				<view :class="['tab-item', activeTab === 'month' ? 'active' : '']" @click="switchTab('month')">
					<uni-icons type="calendar-filled" size="23" :color="activeTab === 'month' ? '#282321' : '#667085'"></uni-icons>
					<text>月账</text>
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
				<view class="modal-title">{{ recordModalTitle }}</view>
				<view v-if="!convertingAdvanceId && recordForm.type !== 'deposit' && recordForm.type !== 'advance'" class="type-tabs">
					<text :class="{ active: recordForm.type === 'income' }" @click="recordForm.type = 'income'">收入</text>
					<text :class="{ active: recordForm.type === 'expense' }" @click="recordForm.type = 'expense'">支出</text>
				</view>
				<view v-else class="deposit-form-tip">{{ recordTypeTip }}</view>
				<input class="input" v-model="recordForm.name" placeholder="记录名，如 工资 / 房租 / 买菜" />
				<input class="input" type="digit" v-model="recordForm.amount" placeholder="金额，如 12.5" />
				<picker mode="date" :value="recordForm.occurredDate" @change="recordForm.occurredDate = $event.detail.value">
					<view class="picker">{{ recordForm.occurredDate }}</view>
				</picker>
				<picker mode="time" :value="recordForm.occurredTime" @change="recordForm.occurredTime = $event.detail.value">
					<view class="picker">{{ recordForm.occurredTime }}</view>
				</picker>
				<input class="input" v-model="recordForm.note" placeholder="备注，可不填" />
				<view class="modal-actions">
					<button @click="closeRecordForm">取消</button>
					<button class="primary-btn" :loading="submitting" @click="submitRecord">{{ recordSubmitText }}</button>
				</view>
			</view>
		</view>

		<view v-if="showHumanRecordForm" class="modal-mask">
			<view class="modal">
				<view class="modal-title">{{ editingHumanRecordId ? '编辑人情记录' : '新人情记录' }}</view>
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
const DEFAULT_CYCLE_START_DAY = 5;

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
			activeTab: 'month',
			monthlySubTab: 'regular',
			selectedCycleMonth: '',
			cycleStartDay: DEFAULT_CYCLE_START_DAY,
			summary: this.getEmptySummary(),
			monthlyEntries: [],
			monthlyPage: 1,
			monthlyTotal: 0,
			monthlyHasMore: false,
			monthlyLoading: false,
			advanceEntries: [],
			advancePage: 1,
			advanceTotal: 0,
			advanceHasMore: false,
			advanceLoading: false,
			depositStats: [],
			recentExpenseStats: [],
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
			convertingAdvanceId: '',
			editingHumanRecordId: '',
			editingFriendId: '',
			recordActionOptions: [
				{ text: '编辑', style: { backgroundColor: '#282321' } },
				{ text: '删除', style: { backgroundColor: '#c8171d' } }
			],
			advanceActionOptions: [
				{ text: '支出', style: { backgroundColor: '#667085' } },
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
			depositChartOpts: this.getColumnChartOpts(['#2563eb'], 16),
			expenseChartOpts: this.getColumnChartOpts(['#c8171d'], 18)
		};
	},
	computed: {
		cycleStartDayOptions() {
			return Array.from({ length: 31 }, (_, index) => `${index + 1}号`);
		},
		cycleRange() {
			return this.getCycleRangeByMonth(this.selectedCycleMonth, this.cycleStartDay);
		},
		cycleTitle() {
			const date = this.parseCycleMonth(this.selectedCycleMonth);
			return `${date.getFullYear()}年${date.getMonth() + 1}月`;
		},
		cycleRangeLabel() {
			const range = this.cycleRange;
			return `${this.formatDateText(range.startAt)} 至 ${this.formatDateText(range.endAt - 1)}`;
		},
		cycleNet() {
			const totals = this.summary && this.summary.totals;
			if (!totals) return 0;
			return Number(totals.periodNet || 0);
		},
		periodAdvance() {
			const totals = this.summary && this.summary.totals;
			return Number((totals && totals.periodAdvance) || 0);
		},
		cycleNetAfterAdvance() {
			return this.cycleNet - this.periodAdvance;
		},
		advanceAfterToneClass() {
			if (this.cycleNetAfterAdvance > 0) return 'positive-text';
			if (this.cycleNetAfterAdvance < 0) return 'danger-text';
			return 'neutral-text';
		},
		recordModalTitle() {
			if (this.convertingAdvanceId) return '转为实际支出';
			if (this.editingRecordId) return '编辑记录';
			return '新建记录';
		},
		recordSubmitText() {
			return this.convertingAdvanceId ? '确认转支出' : '保存';
		},
		recordTypeTip() {
			if (this.convertingAdvanceId) return '确认支出信息';
			if (this.recordForm.type === 'deposit') return '存款记录';
			if (this.recordForm.type === 'advance') return '预支记录';
			return '记录';
		},
		monthlyDepositChartData() {
			return {
				categories: this.depositStats.map((item) => item.label),
				series: [{ name: '存款', data: this.depositStats.map((item) => this.centsToYuan(item.deposit)) }]
			};
		},
		monthlyDepositChartReady() {
			return this.depositStats.some((item) => Number(item.deposit || 0) > 0);
		},
		recentExpenseChartData() {
			return {
				categories: this.recentExpenseStats.map((item) => item.label),
				series: [{ name: '支出', data: this.recentExpenseStats.map((item) => this.centsToYuan(item.expense)) }]
			};
		},
		recentExpenseChartReady() {
			return this.recentExpenseStats.some((item) => Number(item.expense || 0) > 0);
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
		this.selectedCycleMonth = this.getDefaultCycleMonth(this.cycleStartDay);
		this.recordForm.occurredDate = this.formatDateInput(Date.now());
		this.recordForm.occurredTime = this.formatTimeInput(Date.now());
		this.humanRecordForm.occurredDate = this.formatDateInput(Date.now());
		this.humanRecordForm.occurredTime = this.formatTimeInput(Date.now());
		this.init();
	},
	methods: {
		getColumnChartOpts(colors, width) {
			return {
				color: colors,
				padding: [10, 10, 0, 0],
				enableScroll: false,
				dataLabel: false,
				legend: { show: false },
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
						width,
						activeBgColor: '#101828',
						activeBgOpacity: 0.06
					}
				}
			};
		},
		getEmptySummary() {
			return {
				totals: {
					deposit: 0,
					periodIncome: 0,
					periodExpense: 0,
					periodDeposit: 0,
					periodAdvance: 0,
					periodNet: 0
				}
			};
		},
		normalizeSummary(data = {}) {
			const empty = this.getEmptySummary();
			return {
				totals: {
					...empty.totals,
					...(data.totals || {})
				}
			};
		},
		normalizeRangeStats(rows = [], ranges = []) {
			const rowMap = rows.reduce((map, item) => {
				map[item.key] = item;
				return map;
			}, {});
			return ranges.map((range) => {
				const row = rowMap[range.key] || {};
				return {
					...range,
					income: Number(row.income || 0),
					expense: Number(row.expense || 0),
					deposit: Number(row.deposit || 0)
				};
			});
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
			if (result.code !== 0) throw new Error(result.msg || '操作失败');
			return result.data || {};
		},
		async init() {
			this.loading = true;
			try {
				const state = await this.callMoney('getAuthState', {}, false);
				this.hasPassword = state.hasPassword;
				this.token = uni.getStorageSync(TOKEN_KEY) || '';
				if (this.hasPassword && this.token) {
					await this.callMoney('verifyToken', { token: this.token }, false);
					this.authenticated = true;
					await this.loadBookConfig();
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
			if (password.length < 4) return uni.showToast({ title: '密码至少 4 位', icon: 'none' });
			if (!this.hasPassword && password !== this.confirmPasswordInput.trim()) {
				return uni.showToast({ title: '两次密码不一致', icon: 'none' });
			}
			this.submitting = true;
			try {
				if (!this.hasPassword) {
					const state = await this.callMoney('getAuthState', {}, false);
					this.hasPassword = !!state.hasPassword;
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
				await this.loadBookConfig();
				await this.loadAll();
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.submitting = false;
			}
		},
		async loadBookConfig() {
			try {
				const data = await this.callMoney('getBookConfig');
				this.cycleStartDay = this.normalizeCycleStartDay(data.cycleStartDay);
			} catch (e) {
				this.cycleStartDay = DEFAULT_CYCLE_START_DAY;
			}
			this.selectedCycleMonth = this.getDefaultCycleMonth(this.cycleStartDay);
		},
		async saveBookConfig(showToast = true) {
			this.submitting = true;
			try {
				const data = await this.callMoney('updateBookConfig', {
					cycleStartDay: this.cycleStartDay
				});
				this.cycleStartDay = this.normalizeCycleStartDay(data.cycleStartDay);
				await this.loadCycleData();
				if (showToast) uni.showToast({ title: '工资日已保存', icon: 'success' });
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.submitting = false;
			}
		},
		async loadAll() {
			try {
				await this.loadCycleData();
				await Promise.all([
					this.fetchDepositRecords(true),
					this.fetchHumanRecords(true),
					this.loadFriends(),
					this.loadHumanSummary()
				]);
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			}
		},
		async loadCycleData() {
			await Promise.all([
				this.loadSummary(),
				this.fetchMonthlyEntries(true),
				this.fetchAdvanceEntries(true),
				this.loadTrendStats()
			]);
		},
		async loadSummary() {
			const range = this.cycleRange;
			const data = await this.callMoney('getSummary', {
				startAt: range.startAt,
				endAt: range.endAt
			});
			this.summary = this.normalizeSummary(data);
		},
		async loadTrendStats() {
			const depositRanges = this.getRecentCycleRanges(5);
			const expenseRanges = this.getLastDayRanges(5);
			const [depositData, expenseData] = await Promise.all([
				this.callMoney('getRangeStats', { ranges: depositRanges }),
				this.callMoney('getRangeStats', { ranges: expenseRanges })
			]);
			this.depositStats = this.normalizeRangeStats(depositData.ranges || [], depositRanges);
			this.recentExpenseStats = this.normalizeRangeStats(expenseData.ranges || [], expenseRanges);
		},
		async fetchMonthlyEntries(reset) {
			if (this.monthlyLoading) return;
			if (reset) {
				this.monthlyPage = 1;
				this.monthlyEntries = [];
				this.monthlyHasMore = false;
				this.monthlyTotal = 0;
			} else if (!this.monthlyHasMore) {
				return;
			}
			const page = reset ? 1 : this.monthlyPage + 1;
			this.monthlyLoading = true;
			try {
				const range = this.cycleRange;
				const data = await this.callMoney('listMonthlyEntries', {
					startAt: range.startAt,
					endAt: range.endAt,
					page,
					pageSize: 10
				});
				const list = this.sortRecordsByTime(data.entries || data.records || []);
				this.monthlyEntries = this.sortRecordsByTime(reset ? list : this.monthlyEntries.concat(list));
				this.monthlyPage = data.page;
				this.monthlyTotal = data.total;
				this.monthlyHasMore = !!data.hasMore;
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.monthlyLoading = false;
			}
		},
		async fetchAdvanceEntries(reset) {
			if (this.advanceLoading) return;
			if (reset) {
				this.advancePage = 1;
				this.advanceEntries = [];
				this.advanceHasMore = false;
				this.advanceTotal = 0;
			} else if (!this.advanceHasMore) {
				return;
			}
			const page = reset ? 1 : this.advancePage + 1;
			this.advanceLoading = true;
			try {
				const range = this.cycleRange;
				const data = await this.callMoney('listRecords', {
					types: ['advance'],
					startAt: range.startAt,
					endAt: range.endAt,
					page,
					pageSize: 10
				});
				const list = this.sortRecordsByTime(data.records || []);
				this.advanceEntries = this.sortRecordsByTime(reset ? list : this.advanceEntries.concat(list));
				this.advancePage = data.page;
				this.advanceTotal = data.total;
				this.advanceHasMore = !!data.hasMore;
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.advanceLoading = false;
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
		openRecordForm(type = 'expense', record = null) {
			this.convertingAdvanceId = '';
			if (record && record._id) {
				this.editingRecordId = record._id;
				this.recordForm = {
					type: record.type,
					name: record.name || '',
					amount: (Number(record.amount || 0) / 100).toString(),
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
				occurredDate: type === 'deposit' ? this.formatDateInput(Date.now()) : this.getDefaultRecordDate(),
				occurredTime: this.formatTimeInput(Date.now())
			};
			this.showRecordForm = true;
		},
		openAdvanceToExpenseForm(record) {
			this.editingRecordId = record._id;
			this.convertingAdvanceId = record._id;
			this.recordForm = {
				type: 'expense',
				name: record.name || '',
				amount: (Number(record.amount || 0) / 100).toString(),
				note: record.note || '',
				occurredDate: this.formatDateInput(record.occurred_at || Date.now()),
				occurredTime: this.formatTimeInput(record.occurred_at || Date.now())
			};
			this.showRecordForm = true;
		},
		closeRecordForm() {
			this.showRecordForm = false;
			this.editingRecordId = '';
			this.convertingAdvanceId = '';
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
				const isConvertAdvance = !!this.convertingAdvanceId;
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
				this.convertingAdvanceId = '';
				await this.loadAll();
				uni.showToast({ title: isConvertAdvance ? '已转为支出' : isEdit ? '已更新' : '已保存', icon: 'success' });
			} catch (e) {
				uni.showToast({ title: e.message, icon: 'none' });
			} finally {
				this.submitting = false;
			}
		},
		async onMonthlyEntryActionClick(e, entry) {
			if (entry.source === 'human') {
				await this.onHumanRecordActionClick(e, entry);
				return;
			}
			await this.onRecordActionClick(e, entry);
		},
		async onRecordActionClick(e, record) {
			const idx = Number(e && e.index);
			if (idx === 0) {
				this.openRecordForm(record.type, record);
				return;
			}
			if (idx === 1) await this.removeRecord(record);
		},
		async onAdvanceActionClick(e, record) {
			const idx = Number(e && e.index);
			if (idx === 0) return this.openAdvanceToExpenseForm(record);
			if (idx === 1) return this.openRecordForm('advance', record);
			if (idx === 2) return this.removeRecord(record);
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
					friendName: record.friend_name || record.name || '',
					amount: (Number(record.amount || 0) / 100).toString(),
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
					occurredDate: this.getDefaultRecordDate(),
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
				await this.loadAll();
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
				content: `确认删除与「${record.friend_name || record.name || ''}」的这条记录吗？`,
				success: async (res) => {
					if (!res.confirm) return;
					try {
						await that.callMoney('deleteHumanRecord', { id: record._id });
						await that.loadAll();
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
		},
		switchMonthlySubTab(tab) {
			this.monthlySubTab = tab;
		},
		async changeSelectedCycleMonth(e) {
			const value = e && e.detail ? e.detail.value : '';
			if (!value) return;
			this.selectedCycleMonth = this.normalizeCycleMonth(value);
			await this.loadCycleData();
		},
		async changeCycleStartDay(e) {
			const index = Number(e.detail.value || 0);
			this.cycleStartDay = this.normalizeCycleStartDay(index + 1);
			await this.saveBookConfig();
		},
		async handleRefresh() {
			if (this.refreshing) return;
			this.refreshing = true;
			try {
				await this.loadAll();
			} finally {
				setTimeout(() => {
					this.refreshing = false;
				}, 80);
			}
		},
		normalizeCycleStartDay(value) {
			const day = Math.round(Number(value || DEFAULT_CYCLE_START_DAY));
			if (!Number.isFinite(day)) return DEFAULT_CYCLE_START_DAY;
			return Math.min(Math.max(day, 1), 31);
		},
		normalizeCycleMonth(value) {
			if (typeof value === 'string') {
				const match = value.match(/^(\d{4})-(\d{1,2})/);
				if (match) {
					return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}`;
				}
			}
			return this.formatCycleMonth(Date.now());
		},
		parseCycleMonth(value) {
			const normalized = this.normalizeCycleMonth(value);
			const [year, month] = normalized.split('-').map(Number);
			return new Date(year, month - 1, 1);
		},
		formatCycleMonth(timestamp) {
			const date = new Date(timestamp);
			return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
		},
		getDefaultCycleMonth(startDay) {
			const today = this.parseDateInput(Date.now());
			const monthStart = this.getCycleDate(today.getFullYear(), today.getMonth(), startDay);
			if (today.getTime() < monthStart.getTime()) {
				return this.formatCycleMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime());
			}
			return this.formatCycleMonth(today.getTime());
		},
		getCycleDate(year, monthIndex, startDay) {
			const lastDay = new Date(year, monthIndex + 1, 0).getDate();
			return new Date(year, monthIndex, Math.min(startDay, lastDay));
		},
		getCycleRangeByMonth(monthValue, startDay) {
			const base = this.parseCycleMonth(monthValue);
			const start = this.getCycleDate(base.getFullYear(), base.getMonth(), startDay);
			const endBase = new Date(base.getFullYear(), base.getMonth() + 1, 1);
			const end = this.getCycleDate(endBase.getFullYear(), endBase.getMonth(), startDay);
			return { startAt: start.getTime(), endAt: end.getTime() };
		},
		addMonthsToCycleMonth(monthValue, offset) {
			const base = this.parseCycleMonth(monthValue);
			return this.formatCycleMonth(new Date(base.getFullYear(), base.getMonth() + offset, 1).getTime());
		},
		getRecentCycleRanges(count) {
			const ranges = [];
			for (let i = count - 1; i >= 0; i -= 1) {
				const month = this.addMonthsToCycleMonth(this.selectedCycleMonth, -i);
				const range = this.getCycleRangeByMonth(month, this.cycleStartDay);
				const date = this.parseCycleMonth(month);
				ranges.push({
					key: month,
					label: `${date.getMonth() + 1}月`,
					startAt: range.startAt,
					endAt: range.endAt
				});
			}
			return ranges;
		},
		getLastDayRanges(count) {
			const today = this.parseDateInput(Date.now());
			const days = [];
			for (let i = count - 1; i >= 0; i -= 1) {
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
		getDefaultRecordDate() {
			const now = this.parseDateInput(Date.now()).getTime();
			const range = this.cycleRange;
			if (now >= range.startAt && now < range.endAt) return this.formatDateInput(now);
			return this.formatDateInput(range.startAt);
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
			return this.getTimestampByDateTime(this.recordForm.occurredDate, this.recordForm.occurredTime);
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
			return `${date.getMonth() + 1}月${date.getDate()}日`;
		},
		shortDate(timestamp) {
			const date = new Date(timestamp || Date.now());
			return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
		},
		formatMoney(cents, withSign = false) {
			const value = Number(cents || 0) / 100;
			const abs = Math.abs(value);
			const text = abs.toLocaleString('zh-CN', {
				minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
				maximumFractionDigits: 2
			});
			if (withSign) {
				if (value > 0) return `+￥${text}`;
				if (value < 0) return `-￥${text}`;
			}
			return `￥${text}`;
		},
		isExpenseEntry(entry) {
			return ['expense', 'human_expense', 'deposit'].includes(entry.type);
		},
		isAdvanceEntry(entry) {
			return entry && entry.type === 'advance';
		},
		entryDisplayName(entry) {
			if (entry.source === 'human') return entry.friend_name || entry.name || '人情记录';
			return entry.name || '未命名';
		},
		entryTypeText(entry) {
			const map = {
				income: '收入',
				expense: '支出',
				deposit: '存款',
				advance: '预支',
				human_income: '收礼',
				human_expense: '送礼'
			};
			return map[entry.type] || '记录';
		},
		entryAmountText(entry) {
			const prefix = this.isExpenseEntry(entry) || this.isAdvanceEntry(entry) ? '-' : '+';
			return `${prefix}${this.formatMoney(entry.amount)}`;
		},
		entryToneClass(entry) {
			if (['income', 'human_income'].includes(entry.type)) return 'record-dot-income';
			if (['expense', 'human_expense'].includes(entry.type)) return 'record-dot-expense';
			if (entry.type === 'advance') return 'record-dot-advance';
			return 'record-dot-deposit';
		},
		entryIconType(entry) {
			if (entry.source === 'human') return 'gift-filled';
			return { income: 'download-filled', expense: 'upload-filled', deposit: 'wallet-filled', advance: 'compose' }[entry.type] || 'compose';
		},
		entryIconColor(entry) {
			if (['income', 'human_income'].includes(entry.type)) return '#12b76a';
			if (['expense', 'human_expense'].includes(entry.type)) return '#c8171d';
			if (entry.type === 'advance') return '#667085';
			return '#2563eb';
		},
		recordDisplayName(record) {
			return record.name || '未命名';
		},
		recordAmountText(record) {
			const prefix = ['expense', 'deposit', 'advance'].includes(record.type) ? '-' : '+';
			return `${prefix}${this.formatMoney(record.amount)}`;
		}
	}
};
</script>

<style lang="scss">
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
.summary-strip text {
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
	box-sizing: border-box;
}

.primary-btn {
	background: #282321;
	color: #ffffff;
	border-radius: 18rpx;
}

.app-shell {
	min-height: 100vh;
	height: 100vh;
	overflow: hidden;
}

.content {
	height: 100vh;
	padding: 12rpx 12rpx 160rpx;
	box-sizing: border-box;
}

/* #ifdef H5 */
.app-shell {
	min-height: calc(100vh - var(--window-top, 0px));
	height: calc(100vh - var(--window-top, 0px));
}

.content {
	height: 100%;
}
/* #endif */

.hero-card {
	padding: 30rpx 32rpx;
	border-radius: 20rpx;
	background: #282321;
	color: #ffffff;
}

.hero-top,
.hero-date,
.hero-metrics,
.section-header,
.summary-strip,
.bottom-tabbar,
.modal-actions,
.header-actions,
.record-item,
.summary-label {
	display: flex;
	align-items: center;
}

.hero-top,
.section-header,
.summary-strip,
.record-item {
	justify-content: space-between;
}

.hero-date {
	gap: 10rpx;
	font-size: 34rpx;
	font-weight: 700;
}

.hero-date-action {
	display: inline-flex;
}

.hero-profit-label {
	margin-top: 10rpx;
	color: rgba(255, 255, 255, 0.62);
	font-size: 24rpx;
}

.hero-chip {
	padding: 10rpx 18rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.14);
	font-size: 24rpx;
}

.hero-profit-amount {
	margin-top: 14rpx;
	font-size: 58rpx;
	font-weight: 800;
	letter-spacing: 0;
	display: flex;
	align-items: baseline;
	gap: 14rpx;
	flex-wrap: wrap;
}

.hero-profit-loss {
	color: #ffccd5;
}

.advance-minus {
	color: rgba(255, 255, 255, 0.46);
	font-size: 34rpx;
	font-weight: 700;
	white-space: nowrap;
}

.advance-after {
	font-size: 34rpx;
	font-weight: 700;
	white-space: nowrap;
}

.hero-metrics {
	gap: 16rpx;
	margin-top: 24rpx;
}

.hero-metrics view {
	flex: 1;
	padding: 18rpx;
	border-radius: 16rpx;
	background: rgba(255, 255, 255, 0.11);
}

.hero-metrics text {
	display: block;
	color: rgba(255, 255, 255, 0.66);
	font-size: 22rpx;
}

.hero-metrics strong {
	display: block;
	margin-top: 8rpx;
	font-size: 28rpx;
}

.panel {
	margin-top: 22rpx;
	padding: 28rpx;
	box-shadow: none;
}

.section-title {
	font-size: 32rpx;
	font-weight: 800;
	margin-bottom: 8rpx;
}

.section-title-icon {
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.refresh {
	color: #667085;
	font-size: 24rpx;
	display: flex;
	align-items: center;
	gap: 6rpx;
}

.header-actions {
	gap: 12rpx;
	flex-wrap: wrap;
	justify-content: flex-end;
}

.stats-month-pill {
	min-height: 62rpx;
	line-height: 62rpx;
	padding: 0 20rpx;
	border-radius: 18rpx;
	background: #282321;
	color: #ffffff;
	font-size: 24rpx;
	font-weight: 700;
	text-align: center;
	box-sizing: border-box;
	white-space: nowrap;
}

.add-record-btn {
	padding: 12rpx 22rpx;
	border-radius: 999rpx;
	background: #282321;
	color: #ffffff;
	font-size: 24rpx;
	display: flex;
	align-items: center;
	gap: 6rpx;
}

.add-record-btn-green {
	background: #087443;
}

.add-record-btn-muted {
	background: #667085;
}

.add-record-btn-blue {
	background: #2563eb;
}

.add-record-btn-amber {
	background: #b54708;
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

.summary-advance-minus {
	margin-left: 10rpx;
	color: #98a2b3;
	font-size: 24rpx;
	font-weight: 700;
	white-space: nowrap;
}

.summary-advance-after {
	margin-left: 8rpx;
	font-size: 24rpx;
	font-weight: 700;
	white-space: nowrap;
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
	min-width: 0;
}

.summary-label {
	gap: 8rpx;
}

.detail-tabs {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 10rpx;
	margin: 18rpx 0 8rpx;
	padding: 8rpx;
	border-radius: 18rpx;
	background: #f2f4f7;
}

.detail-tabs text {
	height: 58rpx;
	line-height: 58rpx;
	border-radius: 14rpx;
	text-align: center;
	color: #667085;
	font-size: 24rpx;
	font-weight: 700;
}

.detail-tabs .active {
	background: #ffffff;
	color: #282321;
	box-shadow: 0 8rpx 18rpx rgba(16, 24, 40, 0.08);
}

.human-tabs {
	margin: 18rpx 0;
}

.chart-section {
	margin-top: 28rpx;
	padding-top: 26rpx;
	border-top: 1px solid #f0f0f0;
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

.chart-subtitle {
	color: #667085;
	font-size: 22rpx;
	margin-top: 6rpx;
}

.chart-empty {
	padding: 40rpx 0 22rpx;
}

.daily-chart-card {
	height: 360rpx;
}

.danger-text {
	color: #c8171d !important;
}

.positive-text {
	color: #12b76a !important;
}

.neutral-text {
	color: #98a2b3 !important;
}

.timeline {
	position: relative;
	overflow: hidden;
	border-right: 0;
}

.timeline .uni-swipe,
.timeline .uni-swipe_box,
.timeline .uni-swipe_text--center {
	border-right: 0;
	box-shadow: none;
}

.record-item {
	min-height: 116rpx;
	border-bottom: 1px solid #f0f0f0;
	border-right: 0;
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
	flex-shrink: 0;
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

.record-dot-advance {
	background: #f2f4f7;
	border-color: #d0d5dd;
}

.compact-dot {
	width: 64rpx;
	height: 64rpx;
	margin: 0 20rpx 0 8rpx;
}

.record-main {
	flex: 1;
	min-width: 0;
}

.record-name {
	font-size: 30rpx;
	font-weight: 700;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.record-side {
	text-align: right;
	flex-shrink: 0;
	padding-right: 24rpx;
	box-sizing: border-box;
}

.record-amount {
	font-size: 32rpx;
	font-weight: 800;
}

.advance-text {
	color: #98a2b3;
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
