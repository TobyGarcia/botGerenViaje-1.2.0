package com.aspromex.gerenciamientoviajes;
import android.app.job.JobService;
import android.app.job.JobParameters;
public class GpsSyncJob extends JobService {
    @Override public boolean onStartJob(JobParameters params) {
        new Thread(() -> jobFinished(params,!GpsSync.run(getApplicationContext())),"gv-gps-sync").start();
        return true;
    }
    @Override public boolean onStopJob(JobParameters params) { return true; }
}
