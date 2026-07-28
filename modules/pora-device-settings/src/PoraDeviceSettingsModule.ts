import { NativeModule, requireNativeModule } from 'expo';

declare class PoraDeviceSettingsModule extends NativeModule<{}> {
  canScheduleExactAlarms(): boolean;
  isIgnoringBatteryOptimizations(): boolean;
  openExactAlarmSettings(): void;
  openBatteryOptimizationSettings(): void;
}

export default requireNativeModule<PoraDeviceSettingsModule>('PoraDeviceSettings');
