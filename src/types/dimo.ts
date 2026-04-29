export interface VehicleDefinition {
  make: string;
  model: string;
  year: number;
}

export interface SyntheticDevice {
  tokenId: number;
  address: string;
}

export interface AftermarketDevice {
  tokenId: number;
  address: string;
}

export interface Vehicle {
  tokenId: number;
  tokenDID: string;
  owner: string;
  mintedAt: string;
  definition: VehicleDefinition;
  syntheticDevice?: SyntheticDevice | null;
  aftermarketDevice?: AftermarketDevice | null;
}

export interface TelemetrySignal {
  timestamp: string;
  speed: number | null;
  fuelLevel: number | null;           // 0-100 %
  fuelAbsolute: number | null;        // litres
  range: number | null;               // metres
  location: { latitude: number; longitude: number } | null;
  engineRpm: number | null;
  engineCoolantTemp: number | null;   // °C
  throttle: number | null;            // %
  adBlue: number | null;              // %
  batteryVoltage: number | null;      // V
  odometer: number | null;            // km
  exteriorTemp: number | null;        // °C
  isIgnitionOn: number | null;        // 0/1
}

export interface LatestStatus {
  timestamp?: string | null;
  speed?: number | null;
  powertrainFuelSystemRelativeLevel?: number | null;
  powertrainFuelSystemAbsoluteLevel?: number | null;
  powertrainCombustionEngineSpeed?: number | null;
  powertrainCombustionEngineECT?: number | null;
  powertrainCombustionEngineDieselExhaustFluidLevel?: number | null;
  powertrainCombustionEngineTPS?: number | null;
  powertrainTransmissionTravelledDistance?: number | null;
  lowVoltageBatteryCurrentVoltage?: number | null;
  exteriorAirTemperature?: number | null;
  isIgnitionOn?: number | null;
  obdStatusDTCCount?: number | null;
  currentLocationCoordinates?: { latitude: number; longitude: number } | null;
}
