import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardSkeletonProps {
  isAdminOrManager?: boolean;
}

export default function DashboardSkeleton({ isAdminOrManager = true }: DashboardSkeletonProps) {
  return (
    <div className="max-w-[1700px] mx-auto p-3 sm:p-5 lg:p-6 space-y-6 text-foreground">
      {/* ── TOP ACTION BAR SKELETON ────────────────────────── */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-11 w-44 rounded-xl" />
            <Skeleton className="h-11 w-40 rounded-xl" />
          </div>

          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-3 flex-1 lg:max-w-xl">
            <Skeleton className="h-11 flex-1 min-w-[220px] rounded-xl" />
            <Skeleton className="h-11 w-40 rounded-xl" />
          </div>
        </div>
      </div>

      {/* ── EA-LEAD TEMPERATURE PIPELINE SKELETON (MANAGER / ADMIN ONLY) ──── */}
      {isAdminOrManager && (
      <div className="bg-card border rounded-2xl p-6 shadow-sm relative overflow-hidden space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-44 rounded-md" />
                <Skeleton className="h-4 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-64 rounded-md" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
        </div>

        {/* Progress Bar Gauge */}
        <Skeleton className="h-3 w-full rounded-full" />

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted/30 border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-full" />
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <Skeleton className="h-8 w-16 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-md" />
              </div>
              <Skeleton className="h-3 w-36 rounded-md mt-1" />
            </div>
          ))}
        </div>
      </div>
      )}

      {/* ── 2-COLUMN OPERATIONAL GRID SKELETON ──────────────── */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── LEFT COLUMN (~65% width) ───────────────────────── */}
        <div className="flex-1 lg:w-[65%] min-w-0 space-y-6">
          {/* Campaign Acquisition Overview Skeleton */}
          <div className="page-card dark:bg-card border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <Skeleton className="h-6 w-56 rounded-md" />
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-xl" />
                <Skeleton className="h-4 w-12 rounded-md" />
                <Skeleton className="w-8 h-8 rounded-xl" />
              </div>
            </div>

            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-accent/10 rounded-2xl p-4 border border-transparent">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-5 w-48 rounded-md" />
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <Skeleton className="h-3 w-12 rounded-sm mb-1" />
                          <Skeleton className="h-4 w-8 rounded-md" />
                        </div>
                        <div>
                          <Skeleton className="h-3 w-16 rounded-sm mb-1" />
                          <Skeleton className="h-4 w-8 rounded-md" />
                        </div>
                        <div>
                          <Skeleton className="h-3 w-16 rounded-sm mb-1" />
                          <Skeleton className="h-4 w-8 rounded-md" />
                        </div>
                      </div>
                    </div>
                    <Skeleton className="w-10 h-10 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5-Card Stat Cards Grid Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="bg-accent/20 dark:bg-card/40 flex flex-col items-center text-center p-5 rounded-2xl border"
              >
                <Skeleton className="w-10 h-10 rounded-full mb-2.5" />
                <Skeleton className="h-7 w-12 rounded-md mb-1.5" />
                <Skeleton className="h-3 w-20 rounded-md" />
              </div>
            ))}
          </div>

          {/* Strategic Pipeline / Tasks Section Skeleton */}
          <div className="page-card dark:bg-card border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-6 w-44 rounded-md" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20 rounded-xl" />
                <Skeleton className="h-8 w-20 rounded-xl" />
                <Skeleton className="h-8 w-20 rounded-xl" />
              </div>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3.5 bg-accent/10 rounded-xl border">
                <div className="flex items-center gap-3 flex-1">
                  <Skeleton className="w-5 h-5 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-40 rounded-md" />
                    <Skeleton className="h-3 w-28 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-7 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT COLUMN (~35% width) ──────────────────────── */}
        <div className="w-full lg:w-[35%] space-y-6">
          {/* SMS / Live Action Widget Skeleton */}
          <div className="page-card dark:bg-card border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="w-7 h-7 rounded-lg" />
                <Skeleton className="h-5 w-32 rounded-md" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-7 w-24 rounded-lg" />
              <Skeleton className="h-7 w-16 rounded-lg" />
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="p-3 bg-accent/15 rounded-xl space-y-2 border">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28 rounded-md" />
                  <Skeleton className="h-3 w-16 rounded-md" />
                </div>
                <Skeleton className="h-3.5 w-full rounded-md" />
                <Skeleton className="h-3 w-3/4 rounded-md" />
              </div>
            ))}
          </div>

          {/* Stalled Leads Widget Skeleton */}
          <div className="page-card dark:bg-card border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="w-7 h-7 rounded-lg" />
                <Skeleton className="h-5 w-36 rounded-md" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="p-3 bg-accent/15 rounded-xl space-y-2.5 border">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-4 w-12 rounded-md" />
                </div>
                <Skeleton className="h-3 w-48 rounded-md" />
                <div className="flex justify-end pt-1">
                  <Skeleton className="h-7 w-24 rounded-lg" />
                </div>
              </div>
            ))}
          </div>

          {/* Weekly AI Report Widget Skeleton */}
          <div className="page-card dark:bg-card border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="w-7 h-7 rounded-lg" />
                <Skeleton className="h-5 w-40 rounded-md" />
              </div>
              <Skeleton className="h-7 w-20 rounded-xl" />
            </div>
            <div className="space-y-2 bg-accent/10 p-3.5 rounded-xl border">
              <Skeleton className="h-3.5 w-full rounded-md" />
              <Skeleton className="h-3.5 w-5/6 rounded-md" />
              <Skeleton className="h-3.5 w-4/6 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
