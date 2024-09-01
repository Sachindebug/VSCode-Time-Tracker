import fs from 'fs';
import moment from 'moment';
import vscode from 'vscode';
import { ISession, TrackerSession } from './tracker-session';

export class TrackedData {
    private _sessions: ISession[];
    private _totalTime: number;
    private readonly _file: string;

    constructor(storageFile: string) {
        this._file = storageFile;
        this._sessions = [];
        this._totalTime = 0;
        this.load();
    }

    public load() {
        if (fs.existsSync(this._file)) {
            try {
                const dataString = fs.readFileSync(this._file).toString();
                const data = JSON.parse(dataString);
                this._sessions = data.sessions;
                this._totalTime = data.total;
            } catch (error:any) {
                vscode.window.showErrorMessage(`Unable to read time tracking data: ${error.message}`);
            }
        } else {
            this._sessions = [];
            this._totalTime = 0;
        }
    }

    public addNewSession(session: TrackerSession) {
        this.load();
        this._sessions.push(session.export());
        this.updateTotalTime();
        this.saveToFile();
    }

    public get sessions() {
        return this._sessions;
    }

    public get totalTime() {
        return this._totalTime;
    }

    private updateTotalTime() {
        this._totalTime = this._sessions.map(s => s.duration).reduce((acc, d) => acc += d);
    }

    public recomputeTotalTime() {
        this.load();
        this._sessions.forEach(it => {
            if (typeof it.begin === 'string') {
                it.begin = moment(it.begin);
            }
            if (typeof it.end === 'string') {
                it.end = moment(it.end);
            }
            it.duration = it.end.diff(it.begin, 's');
        });
        this.updateTotalTime();
        this.saveToFile();
    }

    public saveToFile() {
        try {
            fs.writeFileSync(this._file, JSON.stringify({
                total: this._totalTime,
                sessions: this._sessions,
            }, null, vscode.workspace.getConfiguration('timetracker').dotTimeTrackerIndent), {
                encoding: 'utf-8'
            });
        } catch (error:any) {
            vscode.window.showErrorMessage(`Unable to save time tracking data: ${error.message}`);
        }
    }
}