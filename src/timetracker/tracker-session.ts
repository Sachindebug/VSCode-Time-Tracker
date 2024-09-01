import { Moment } from 'moment';
import moment from 'moment';

moment.fn.toJSON = function () { return this.format(); };

export interface ISession {
    begin: Moment;
    end: Moment;
    duration: number;
}

export class TrackerSession {
    private _begin: Moment = moment(new Date());
    private _end: Moment = this._begin;
    private _duration: number = 0;

    constructor(start: boolean = true) {
        if (start) {
            this._begin = moment(new Date());
        }
    }

    public get begin() {
        return this._begin;
    }

    public get end() {
        return this._end;
    }

    public get duration() {
        return this._duration;
    }

    public start() {
        this._begin = moment(new Date());
        this._end = this._begin;
    }

    public stop() {
        this._end = moment(new Date());
        this._duration = this._end.diff(this._begin, 's');
    }

    public currentDuration() {
        return moment(new Date()).diff(this._begin, 's');
    }
    
    public export(): ISession {
        return {
            begin: this.begin,
            end: this.end,
            duration: this.duration
        };
    }
}