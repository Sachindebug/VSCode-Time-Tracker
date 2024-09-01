import path from 'path';
import vscode from 'vscode';
import { TrackedData } from './tracked-data';
import { TrackerSession } from './tracker-session';

export enum TimeTrackerState {
    Stopped,
    Started,
    Paused
}
export type TAction<T> = (subject: T) => void;
export type TTimeTrackerAction = TAction<TimeTracker>;

export class TimeTracker {
    public readonly dataFileName = '.tracked-time-data';
    private _state: TimeTrackerState;
    private _maxIdleTimeToCloseSession: number = 120;
    private _trackedData?: TrackedData;
    private _currentSession?: TrackerSession;
    private _idleTime: number = 0; // track idleTime to close pause tracker on inactivity
    private _onActiveStateTick?: TTimeTrackerAction;
    private _tickTimer?: NodeJS.Timeout;

    constructor() {
        this._state = TimeTrackerState.Stopped;

        const rootFolder = vscode.workspace.rootPath; // get the root folder to append a new file to it

        if (rootFolder) {
            const filePath = path.join(rootFolder, this.dataFileName);
            this._trackedData = this._trackedData ?? new TrackedData(filePath);
        }
    }
    get state(): TimeTrackerState {
        return this._state;
    }

    set state(value: TimeTrackerState) {
        this._state = value;
    }

    set maxIdleTimeToCloseSession(value: number) {
        this._maxIdleTimeToCloseSession = value;
    }

    get maxIdleTimeToCloseSession() {
        return this._maxIdleTimeToCloseSession;
    }

    public get trackedData() {
        return this._trackedData;
    }

    public get currentSession() {
        return this._currentSession;
    }

    public get idleTime() {
        return this._idleTime;
    }

    private startTickTimer() {
        this._tickTimer = setInterval(() => {
            if (this._onActiveStateTick) {
                this._onActiveStateTick(this);
            }
            if (this._maxIdleTimeToCloseSession > 0) {
                this._idleTime++;
            }
            if (this.idleTime > this._maxIdleTimeToCloseSession) {
                this.pause();
            }
        }, 1000);
    }

    private stopTickTimer() {
        if (this._tickTimer) {
            clearInterval(this._tickTimer);
        }
    }

    public start(action?: TTimeTrackerAction): boolean {
        if (this._currentSession && this._state === TimeTrackerState.Started) {
            vscode.window.showWarningMessage('Another time tracking session is already active, please stop previous to start the new one');
            return false;
        }

        const rootFolder = vscode.workspace.rootPath;

        if (!rootFolder) {
            vscode.window.showWarningMessage('A folder should be opened to store time tracking data!');
            return false;
        }

        const filePath = path.join(rootFolder, this.dataFileName);
        this._trackedData = this._trackedData ?? new TrackedData(filePath);
        this._state = TimeTrackerState.Started;

        this._currentSession = new TrackerSession(true);

        this._onActiveStateTick = action;
        this.startTickTimer();

        return true;
    }

    public pause(): boolean {
        if (this._currentSession && this._state === TimeTrackerState.Started) {
            this._currentSession?.stop();
            this._trackedData?.addNewSession(this._currentSession);
            delete this._currentSession;
            this._state = TimeTrackerState.Paused;
            this.stopTickTimer();
            this._idleTime = 0;
            if (this._onActiveStateTick) {
                this._onActiveStateTick(this);
            }
            return true;
        } else {
            return false;
        }
    }

    public continue(): boolean {
        this._state = TimeTrackerState.Started;
        this._currentSession = new TrackerSession(true);
        this.startTickTimer();
        return true;
    }

    public stop(): boolean {
        if (this._currentSession && this._state !== TimeTrackerState.Stopped) {
            this._currentSession?.stop();
            this._trackedData?.addNewSession(this._currentSession);
            delete this._currentSession;
            this._state = TimeTrackerState.Stopped;
            this.stopTickTimer();
            this._idleTime = 0;
            if (this._onActiveStateTick) {
                this._onActiveStateTick(this);
            }
            return true;
        } else {
            vscode.window.showInformationMessage('No active tracking session to stop.');
            return false;
        }
    }

    public resetIdleTime() {
        this._idleTime = 0;
    }

    public recompute(): boolean {
        this.trackedData?.recomputeTotalTime();
        return true;
    }
}