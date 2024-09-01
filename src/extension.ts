// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import moment from 'moment';
import 'moment-duration-format';
import path from 'path';
import * as vscode from 'vscode';
import { TimeTracker ,TimeTrackerState} from './timetracker/time-tracker';
import fs from 'fs';

const tracker: TimeTracker = new TimeTracker();
let statusBarItem: vscode.StatusBarItem;
let useCompactStatusPanel = false;

const COMMAND_START = "time-tracker.start";
const COMMAND_STOP = "time-tracker.stop";
const COMMAND_PAUSE = "time-tracker.pause";
const COMMAND_RECOMPUTE = "time-tracker.recompute";
const OPEN_WEB_VIEW = "time-tracker.open-web-view";

let ICON_STARTED = '$(debug-start)';
let ICON_PAUSED = '$(debug-pause)';
let ICON_STOPPED = '$(debug-stop)';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// creating status bar item and giving it a high priority to always show
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left,1000000000);
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// webview for showing data for a week
	let webview: vscode.WebviewPanel | undefined;

	// on change on files or opening a new file
	context.subscriptions.push(
		vscode.window.onDidChangeVisibleTextEditors(() => {
			reactOnActions();
		}),
		vscode.window.onDidChangeActiveTextEditor(() => {
			reactOnActions();
		}),
		vscode.window.onDidChangeTextEditorSelection((e) => {
			if (path.basename(e.textEditor.document.fileName) !== tracker.dataFileName) {
				reactOnActions();
			}
		})
	);

	// commands registration
	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_START, () => {
			if (tracker.start(updateStatusBarItem)) {
				updateStatusBarItem(tracker);
			}
		}),
		vscode.commands.registerCommand(COMMAND_STOP, () => {
			if (tracker.stop()) {
				updateStatusBarItem(tracker);
			}
		}),
		vscode.commands.registerCommand(COMMAND_PAUSE, () => {
			if (tracker.state === TimeTrackerState.Started) {
				if (tracker.pause()) {
					updateStatusBarItem(tracker);
				}
			}
		}),
		// register command for opening and showing webview
		vscode.commands.registerCommand(OPEN_WEB_VIEW, () => {
			if (!webview) {
				webview = vscode.window.createWebviewPanel(
				  'TimeTracker',
				  'Time Tracker',
				  vscode.ViewColumn.Three,
				  {
					enableScripts: true,
					retainContextWhenHidden: true
				  }
				);
				webview.webview.html = getWebviewContent();
				webview.onDidDispose(() => {
				  webview = undefined;
				}, null, context.subscriptions);
			  } else {
				webview.reveal(vscode.ViewColumn.Three);
			  }
		}),
		vscode.commands.registerCommand(COMMAND_RECOMPUTE, () => {
			if (tracker.recompute()) {
				updateStatusBarItem(tracker);
			}
		})
	);

	// get the configrations and start tracking
	const config = vscode.workspace.getConfiguration('time-tracker');
	const askAboutStart = config.autostart.askAboutAutoStart;
	useCompactStatusPanel = config.useCompactStatusPanel;
	const pauseAfter = config.pauseAfter;
	const autoStartTimeTracking = config.autostart.autoStartTimeTracking;
	const autoCreateTimeTrackingFile = config.autostart.autoCreateTimeTrackingFile;
	

	if (useCompactStatusPanel) {
		ICON_STARTED = '$(watch)';
		ICON_STOPPED = '';
	}

	tracker.maxIdleTimeToCloseSession = pauseAfter;

	const rootFolder = vscode.workspace.rootPath;

	if (autoStartTimeTracking) {
		if (autoCreateTimeTrackingFile) {
			if (askAboutStart) {
				vscode.window.showInformationMessage("Do you want to create time tracker file and start time tracking?", "Yes", "No").then(value => {
					if (value === "Yes") {
						tracker.start(updateStatusBarItem);
					}
				});
			} else {
				tracker.start(updateStatusBarItem);
			}
		} else {
			if (rootFolder) {
				const filePath = path.join(rootFolder, tracker.dataFileName);
				if (fs.existsSync(filePath)) {
					if (askAboutStart) {
						vscode.window.showInformationMessage("Do you want to start time tracking?", "Yes", "No").then(value => {
							if (value === "Yes") {
								tracker.start(updateStatusBarItem);
							}
						});
					} else {
						tracker.start(updateStatusBarItem);
					}
				}
			}
		}
	}

	updateStatusBarItem(tracker);
}

const reactOnActions =() => {
	switch (tracker.state) {
		case TimeTrackerState.Started:
			tracker.resetIdleTime();
			break;
		case TimeTrackerState.Paused:
			tracker.continue();
			break;
		case TimeTrackerState.Stopped:
			break;
	}
};

const updateStatusBarItem = (timeTracker: TimeTracker) => {
	const data = timeTracker.trackedData;
	if (data) {
		const currentSessionSeconds = tracker.currentSession?.currentDuration() ?? 0;
		const totalSeconds = data.totalTime + currentSessionSeconds;
		const icon = timeTracker.state === TimeTrackerState.Started ? ICON_STARTED : timeTracker.state === TimeTrackerState.Stopped ? ICON_STOPPED : ICON_PAUSED;
		const state = timeTracker.state === TimeTrackerState.Started ? 'Active' : timeTracker.state === TimeTrackerState.Stopped ? 'Inactive' : 'Paused';

		const currentSessionTime = (moment.duration(currentSessionSeconds, 's') as any).format('hh:mm:ss', { trim: false });
		const totalTime = (moment.duration(totalSeconds, 's') as any).format('hh:mm', { trim: false });

		if (useCompactStatusPanel) {
			statusBarItem.text = `${icon}${totalTime}+${currentSessionTime}`;
			statusBarItem.tooltip = `State: ${state}   Total: ${totalTime}   Current session: ${currentSessionTime}`;
		} else {
			statusBarItem.text = `${icon} ${state}   Total: ${totalTime}   Current session: ${currentSessionTime}`;
		}
		statusBarItem.command = timeTracker.state === TimeTrackerState.Started ? COMMAND_STOP : COMMAND_START;
	}
};


const getWebviewContent = () => {
	// write js code to get time spent in last 7 days
	const data = tracker.trackedData;
	const last7Days:string[] = [];
	const today = new Date();
	for (let i = 0; i < 7; i++) {
		const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
		last7Days.push(date.toLocaleDateString());
	}
	const totalTimeSpentPerDay:any = {};
	data?.sessions.forEach((session) => {
		const sessionDate = new Date().toLocaleDateString();
		if (last7Days.includes(sessionDate)) {
			if (!totalTimeSpentPerDay[sessionDate]) {
				totalTimeSpentPerDay[sessionDate] = 0;
			}
			totalTimeSpentPerDay[sessionDate] += session.duration;
		}
	});

	// return the html from here
	return`
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Daily Activity Bar Graph</title>
			<style>
				body {
					font-family: Arial, sans-serif;
					display: flex;
					justify-content: center;
					align-items: center;
					height: 100vh;
					margin: 0;
					background-color: black;
				}
				.chart-container {
					width: 400px;
					height: 250px;
				}
				.bar-chart {
					display: flex;
					justify-content: space-between;
					align-items: flex-end;
					height: 200px;
					padding: 10px;
					border-left: 2px solid #ccc;
					border-bottom: 2px solid #ccc;
					position: relative;
				}
				.bar {
					width: 30px;
					background-color: #9AC1C9;
					border-radius: 5px 5px 0 0;
				}
				.bar.active {
					background-color: #4A726E;
				}
				.bar-labels{
					display:flex;
					justify-content: space-between;
					align-items: flex-end;	
					padding: 10px;
				}
				.bar-label {
					text-align: center;
					margin-top: 5px;
				}
				.bar-chart::before {
					position: absolute;
					bottom: 0;
					left: -20px;
				}
				.bar-chart::after {
					position: absolute;
					top: 0;
					left: -20px;
				}
				.total-time {
					text-align: center;
					margin-bottom: 10px;
					font-size: 1.5em;
				}
			</style>
		</head>
		<body>
		<div class="chart-container">
			<div class="total-time">${1} hour, 42 mins</div>
			<div class="bar-chart">
				<div class="bar" style="height: 75%;" data-time="3 hrs"></div>
				<div class="bar" style="height: 75%;" data-time="3 hrs"></div>
				<div class="bar" style="height: 65%;" data-time="2.5 hrs"></div>
				<div class="bar" style="height: 45%;" data-time="1 hr, 41 mins"></div>
				<div class="bar" style="height: 70%;" data-time="2 hrs, 45 mins"></div>
				<div class="bar" style="height: 90%;" data-time="3.5 hrs"></div>
				<div class="bar" style="height: 50%;" data-time="2 hrs"></div>
			</div>
			<div class="bar-labels">
				<!-- Labels will be inserted by JavaScript -->
			</div>
			<div style="padding: 10px;">
				<b>Time spent this week:</b> 13 hr, 32 mins
			<div>
		</div>
		<script>
			const bars = document.querySelectorAll('.bar');
			const totalTime = document.querySelector('.total-time');
			const barLabelsContainer = document.querySelector('.bar-labels');

			const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

			// Get today's day index
			const today = new Date();
			const todayIndex = today.getDay(); // 0 is Sunday, 6 is Saturday

			// Populate labels
			for (let i = 6; i >= 0; i--) {
				const dayIndex = (todayIndex - i + 7) % 7;
				const dayLabel = document.createElement('div');
				dayLabel.className = 'bar-label';
				dayLabel.textContent = daysOfWeek[dayIndex];
				barLabelsContainer.appendChild(dayLabel);
			}

			bars.forEach(bar => {
				bar.addEventListener('click', () => {
					// Remove active class from all bars
					bars.forEach(b => b.classList.remove('active'));
					// Add active class to the clicked bar
					bar.classList.add('active');
					// Update the total time display
					totalTime.textContent = bar.dataset.time;
				});
			});

			document.querySelectorAll('.bar')[6].click();
		</script>
	</html>
	`;
};

// This method is called when your extension is deactivated
export function deactivate() {
	tracker.stop();
}
