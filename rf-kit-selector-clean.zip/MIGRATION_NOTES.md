# Webhook Migration Instructions

## Current State
- Website uses OLD webhook format
- Files: index.html, style.css, app.js
- Working with simple viable_kits array

## Goal
- Update to NEW webhook format
- Support new data structure with recommendedKits
- Add technical scores, value analysis, detailed recommendations

## OLD Response Format
```json
{
  "viable_kits": [
    {
      "name": "KIT 3 - opción 1",
      "radio": "Cambium 4600C",
      "antenna": "Antena Txpro 30 dbi",
      "link_margin": "17.95",
      "cost": "1940"
    }
  ],
  "high_reliability_recommendation": "KIT 3 - opción 3",
  "best_value_recommendation": "KIT 3 - opción 1"
}
## NEW RESPONSE Format Example
[
  {
    "response": {
      "body": [
        {
          "recommendedKits": [
            {
              "row_number": 2,
              "KIT": "KIT 2",
              "MB": "100 - 200 MB",
              "Distancia (km)": 8,
              "Cost (USD)": 1241,
              "Antena": "Antena 30 dB ubiquiti",
              "Modelo Antena": "AF-5G30-S45",
              "Link Budget (dB)": null,
              "radios": [
                {
                  "Radio": "Mimosa C5c",
                  "Modelo Radio": "C5c",
                  "FrequencyBand (GHz)": 5.9,
                  "MaxThroughput (Mbps)": 700,
                  "TransmitPower (dBm)": 27,
                  "ReceiverSensitivity (dBm)": "-87 dBm @ 80 MHz\n-90 dBm @ 40 MHz\n-93 dBm @ 20 MHz",
                  "AntennaGain (dBi)": 26,
                  "SelectedReceiverSensitivity (dBm)": -90,
                  "FrequencyMatchInfo": {
                    "type": "frequency_matched",
                    "matchedFrequency": 40,
                    "frequencyDifference": 0,
                    "isExactMatch": true
                  },
                  "FSPL_dB": 126.05,
                  "LinkMargin_dB": 42.95,
                  "ReceivedPower_dBm": -47.05,
                  "detailedCalculations": {
                    "fspl": {
                      "formula": "FSPL (dB) = 20×log₁₀(d_km) + 20×log₁₀(f_MHz) + 32.45",
                      "distanceKm": 8.116,
                      "frequencyMHz": 5900,
                      "distanceComponent": 18.19,
                      "frequencyComponent": 75.42,
                      "constantComponent": 32.45,
                      "calculation": "18.19 + 75.42 + 32.45 = 126.05 dB"
                    },
                    "linkMargin": {
                      "linkBudgetFormula": "P_received = P_tx + G_tx + G_rx - FSPL",
                      "linkMarginFormula": "Link Margin = P_received - Receiver Sensitivity",
                      "txPower": 27,
                      "txAntennaGain": 26,
                      "rxAntennaGain": 26,
                      "fspl": 126.05,
                      "receiverSensitivity": -90,
                      "receivedPowerCalculation": "27 + 26 + 26 - 126.05 = -47.05 dBm",
                      "linkMarginCalculation": "-47.05 - (-90) = 42.95 dB"
                    }
                  },
                  "calculationParameters": {
                    "distanceKm": 8.116,
                    "frequencyGHz": 5.9,
                    "frequencyMHz": 5900,
                    "transmitPower_dBm": 27,
                    "antennaGain_dBi": 26,
                    "receiverSensitivity_dBm": -90
                  },
                  "linkAnalysis": {
                    "quality": "Excellent",
                    "recommendation": "Link has excellent margin - very reliable",
                    "marginCategory": "Adequate"
                  },
                  "calculationStatus": "Success",
                  "calculationNotes": null
                }
              ],
              "requirements": {
                "requiredFrequency": "40 MHz",
                "providedBandwidth": 150,
                "providedDistanceKm": 8.116,
                "matchedRange": "100 - 200 MB"
              },
              "rfCalculationSummary": {
                "totalRadios": 1,
                "successfulCalculations": 1,
                "averageFSPL": 126.05,
                "averageLinkMargin": 42.95,
                "averageReceivedPower": -47.05,
                "bestLinkMargin": null,
                "worstLinkMargin": null,
                "diversityAnalysisApplicable": false,
                "linkMarginRange": 0,
                "overallKitQuality": "Excellent"
              },
              "technicalScore": 7.8,
              "valueAnalysis": {
                "valueScore": 10,
                "valueCategory": "Exceptional Value",
                "performancePerDollar": 6.29,
                "costEfficiencyRatio": 6.3
              },
              "recommendation": {
                "category": "Budget Choice",
                "description": "Cost-effective option with good performance. 43.0 dB margin sufficient for most applications at excellent value.",
                "priority": 4,
                "confidence": "Medium"
              },
              "quickMetrics": {
                "technicalRating": "7.8/10",
                "valueRating": "10/10",
                "linkMargin": "42.95 dB",
                "costPerformanceRatio": 6.3,
                "totalCost": "$1241",
                "recommendationSummary": "Budget Choice"
              }
            }
          ],
          "summary": {
            "totalKitsAnalyzed": 1,
            "topRecommendation": {
              "kit": "KIT 2",
              "technicalScore": 7.8,
              "valueScore": 10,
              "category": "Budget Choice",
              "cost": 1241,
              "linkMargin": 42.95
            },
            "bestTechnicalPerformance": {
              "row_number": 2,
              "KIT": "KIT 2",
              "MB": "100 - 200 MB",
              "Distancia (km)": 8,
              "Cost (USD)": 1241,
              "Antena": "Antena 30 dB ubiquiti",
              "Modelo Antena": "AF-5G30-S45",
              "Link Budget (dB)": null,
              "radios": [
                {
                  "Radio": "Mimosa C5c",
                  "Modelo Radio": "C5c",
                  "FrequencyBand (GHz)": 5.9,
                  "MaxThroughput (Mbps)": 700,
                  "TransmitPower (dBm)": 27,
                  "ReceiverSensitivity (dBm)": "-87 dBm @ 80 MHz\n-90 dBm @ 40 MHz\n-93 dBm @ 20 MHz",
                  "AntennaGain (dBi)": 26,
                  "SelectedReceiverSensitivity (dBm)": -90,
                  "FrequencyMatchInfo": {
                    "type": "frequency_matched",
                    "matchedFrequency": 40,
                    "frequencyDifference": 0,
                    "isExactMatch": true
                  },
                  "FSPL_dB": 126.05,
                  "LinkMargin_dB": 42.95,
                  "ReceivedPower_dBm": -47.05,
                  "detailedCalculations": {
                    "fspl": {
                      "formula": "FSPL (dB) = 20×log₁₀(d_km) + 20×log₁₀(f_MHz) + 32.45",
                      "distanceKm": 8.116,
                      "frequencyMHz": 5900,
                      "distanceComponent": 18.19,
                      "frequencyComponent": 75.42,
                      "constantComponent": 32.45,
                      "calculation": "18.19 + 75.42 + 32.45 = 126.05 dB"
                    },
                    "linkMargin": {
                      "linkBudgetFormula": "P_received = P_tx + G_tx + G_rx - FSPL",
                      "linkMarginFormula": "Link Margin = P_received - Receiver Sensitivity",
                      "txPower": 27,
                      "txAntennaGain": 26,
                      "rxAntennaGain": 26,
                      "fspl": 126.05,
                      "receiverSensitivity": -90,
                      "receivedPowerCalculation": "27 + 26 + 26 - 126.05 = -47.05 dBm",
                      "linkMarginCalculation": "-47.05 - (-90) = 42.95 dB"
                    }
                  },
                  "calculationParameters": {
                    "distanceKm": 8.116,
                    "frequencyGHz": 5.9,
                    "frequencyMHz": 5900,
                    "transmitPower_dBm": 27,
                    "antennaGain_dBi": 26,
                    "receiverSensitivity_dBm": -90
                  },
                  "linkAnalysis": {
                    "quality": "Excellent",
                    "recommendation": "Link has excellent margin - very reliable",
                    "marginCategory": "Adequate"
                  },
                  "calculationStatus": "Success",
                  "calculationNotes": null
                }
              ],
              "requirements": {
                "requiredFrequency": "40 MHz",
                "providedBandwidth": 150,
                "providedDistanceKm": 8.116,
                "matchedRange": "100 - 200 MB"
              },
              "rfCalculationSummary": {
                "totalRadios": 1,
                "successfulCalculations": 1,
                "averageFSPL": 126.05,
                "averageLinkMargin": 42.95,
                "averageReceivedPower": -47.05,
                "bestLinkMargin": null,
                "worstLinkMargin": null,
                "diversityAnalysisApplicable": false,
                "linkMarginRange": 0,
                "overallKitQuality": "Excellent"
              },
              "technicalScore": 7.8,
              "valueAnalysis": {
                "valueScore": 10,
                "valueCategory": "Exceptional Value",
                "performancePerDollar": 6.29,
                "costEfficiencyRatio": 6.3
              },
              "recommendation": {
                "category": "Budget Choice",
                "description": "Cost-effective option with good performance. 43.0 dB margin sufficient for most applications at excellent value.",
                "priority": 4,
                "confidence": "Medium"
              },
              "quickMetrics": {
                "technicalRating": "7.8/10",
                "valueRating": "10/10",
                "linkMargin": "42.95 dB",
                "costPerformanceRatio": 6.3,
                "totalCost": "$1241",
                "recommendationSummary": "Budget Choice"
              }
            },
            "bestValue": {
              "row_number": 2,
              "KIT": "KIT 2",
              "MB": "100 - 200 MB",
              "Distancia (km)": 8,
              "Cost (USD)": 1241,
              "Antena": "Antena 30 dB ubiquiti",
              "Modelo Antena": "AF-5G30-S45",
              "Link Budget (dB)": null,
              "radios": [
                {
                  "Radio": "Mimosa C5c",
                  "Modelo Radio": "C5c",
                  "FrequencyBand (GHz)": 5.9,
                  "MaxThroughput (Mbps)": 700,
                  "TransmitPower (dBm)": 27,
                  "ReceiverSensitivity (dBm)": "-87 dBm @ 80 MHz\n-90 dBm @ 40 MHz\n-93 dBm @ 20 MHz",
                  "AntennaGain (dBi)": 26,
                  "SelectedReceiverSensitivity (dBm)": -90,
                  "FrequencyMatchInfo": {
                    "type": "frequency_matched",
                    "matchedFrequency": 40,
                    "frequencyDifference": 0,
                    "isExactMatch": true
                  },
                  "FSPL_dB": 126.05,
                  "LinkMargin_dB": 42.95,
                  "ReceivedPower_dBm": -47.05,
                  "detailedCalculations": {
                    "fspl": {
                      "formula": "FSPL (dB) = 20×log₁₀(d_km) + 20×log₁₀(f_MHz) + 32.45",
                      "distanceKm": 8.116,
                      "frequencyMHz": 5900,
                      "distanceComponent": 18.19,
                      "frequencyComponent": 75.42,
                      "constantComponent": 32.45,
                      "calculation": "18.19 + 75.42 + 32.45 = 126.05 dB"
                    },
                    "linkMargin": {
                      "linkBudgetFormula": "P_received = P_tx + G_tx + G_rx - FSPL",
                      "linkMarginFormula": "Link Margin = P_received - Receiver Sensitivity",
                      "txPower": 27,
                      "txAntennaGain": 26,
                      "rxAntennaGain": 26,
                      "fspl": 126.05,
                      "receiverSensitivity": -90,
                      "receivedPowerCalculation": "27 + 26 + 26 - 126.05 = -47.05 dBm",
                      "linkMarginCalculation": "-47.05 - (-90) = 42.95 dB"
                    }
                  },
                  "calculationParameters": {
                    "distanceKm": 8.116,
                    "frequencyGHz": 5.9,
                    "frequencyMHz": 5900,
                    "transmitPower_dBm": 27,
                    "antennaGain_dBi": 26,
                    "receiverSensitivity_dBm": -90
                  },
                  "linkAnalysis": {
                    "quality": "Excellent",
                    "recommendation": "Link has excellent margin - very reliable",
                    "marginCategory": "Adequate"
                  },
                  "calculationStatus": "Success",
                  "calculationNotes": null
                }
              ],
              "requirements": {
                "requiredFrequency": "40 MHz",
                "providedBandwidth": 150,
                "providedDistanceKm": 8.116,
                "matchedRange": "100 - 200 MB"
              },
              "rfCalculationSummary": {
                "totalRadios": 1,
                "successfulCalculations": 1,
                "averageFSPL": 126.05,
                "averageLinkMargin": 42.95,
                "averageReceivedPower": -47.05,
                "bestLinkMargin": null,
                "worstLinkMargin": null,
                "diversityAnalysisApplicable": false,
                "linkMarginRange": 0,
                "overallKitQuality": "Excellent"
              },
              "technicalScore": 7.8,
              "valueAnalysis": {
                "valueScore": 10,
                "valueCategory": "Exceptional Value",
                "performancePerDollar": 6.29,
                "costEfficiencyRatio": 6.3
              },
              "recommendation": {
                "category": "Budget Choice",
                "description": "Cost-effective option with good performance. 43.0 dB margin sufficient for most applications at excellent value.",
                "priority": 4,
                "confidence": "Medium"
              },
              "quickMetrics": {
                "technicalRating": "7.8/10",
                "valueRating": "10/10",
                "linkMargin": "42.95 dB",
                "costPerformanceRatio": 6.3,
                "totalCost": "$1241",
                "recommendationSummary": "Budget Choice"
              }
            },
            "bestLinkMargin": {
              "row_number": 2,
              "KIT": "KIT 2",
              "MB": "100 - 200 MB",
              "Distancia (km)": 8,
              "Cost (USD)": 1241,
              "Antena": "Antena 30 dB ubiquiti",
              "Modelo Antena": "AF-5G30-S45",
              "Link Budget (dB)": null,
              "radios": [
                {
                  "Radio": "Mimosa C5c",
                  "Modelo Radio": "C5c",
                  "FrequencyBand (GHz)": 5.9,
                  "MaxThroughput (Mbps)": 700,
                  "TransmitPower (dBm)": 27,
                  "ReceiverSensitivity (dBm)": "-87 dBm @ 80 MHz\n-90 dBm @ 40 MHz\n-93 dBm @ 20 MHz",
                  "AntennaGain (dBi)": 26,
                  "SelectedReceiverSensitivity (dBm)": -90,
                  "FrequencyMatchInfo": {
                    "type": "frequency_matched",
                    "matchedFrequency": 40,
                    "frequencyDifference": 0,
                    "isExactMatch": true
                  },
                  "FSPL_dB": 126.05,
                  "LinkMargin_dB": 42.95,
                  "ReceivedPower_dBm": -47.05,
                  "detailedCalculations": {
                    "fspl": {
                      "formula": "FSPL (dB) = 20×log₁₀(d_km) + 20×log₁₀(f_MHz) + 32.45",
                      "distanceKm": 8.116,
                      "frequencyMHz": 5900,
                      "distanceComponent": 18.19,
                      "frequencyComponent": 75.42,
                      "constantComponent": 32.45,
                      "calculation": "18.19 + 75.42 + 32.45 = 126.05 dB"
                    },
                    "linkMargin": {
                      "linkBudgetFormula": "P_received = P_tx + G_tx + G_rx - FSPL",
                      "linkMarginFormula": "Link Margin = P_received - Receiver Sensitivity",
                      "txPower": 27,
                      "txAntennaGain": 26,
                      "rxAntennaGain": 26,
                      "fspl": 126.05,
                      "receiverSensitivity": -90,
                      "receivedPowerCalculation": "27 + 26 + 26 - 126.05 = -47.05 dBm",
                      "linkMarginCalculation": "-47.05 - (-90) = 42.95 dB"
                    }
                  },
                  "calculationParameters": {
                    "distanceKm": 8.116,
                    "frequencyGHz": 5.9,
                    "frequencyMHz": 5900,
                    "transmitPower_dBm": 27,
                    "antennaGain_dBi": 26,
                    "receiverSensitivity_dBm": -90
                  },
                  "linkAnalysis": {
                    "quality": "Excellent",
                    "recommendation": "Link has excellent margin - very reliable",
                    "marginCategory": "Adequate"
                  },
                  "calculationStatus": "Success",
                  "calculationNotes": null
                }
              ],
              "requirements": {
                "requiredFrequency": "40 MHz",
                "providedBandwidth": 150,
                "providedDistanceKm": 8.116,
                "matchedRange": "100 - 200 MB"
              },
              "rfCalculationSummary": {
                "totalRadios": 1,
                "successfulCalculations": 1,
                "averageFSPL": 126.05,
                "averageLinkMargin": 42.95,
                "averageReceivedPower": -47.05,
                "bestLinkMargin": null,
                "worstLinkMargin": null,
                "diversityAnalysisApplicable": false,
                "linkMarginRange": 0,
                "overallKitQuality": "Excellent"
              },
              "technicalScore": 7.8,
              "valueAnalysis": {
                "valueScore": 10,
                "valueCategory": "Exceptional Value",
                "performancePerDollar": 6.29,
                "costEfficiencyRatio": 6.3
              },
              "recommendation": {
                "category": "Budget Choice",
                "description": "Cost-effective option with good performance. 43.0 dB margin sufficient for most applications at excellent value.",
                "priority": 4,
                "confidence": "Medium"
              },
              "quickMetrics": {
                "technicalRating": "7.8/10",
                "valueRating": "10/10",
                "linkMargin": "42.95 dB",
                "costPerformanceRatio": 6.3,
                "totalCost": "$1241",
                "recommendationSummary": "Budget Choice"
              }
            },
            "recommendationMatrix": [
              {
                "kit": "KIT 2",
                "technical": 7.8,
                "value": 10,
                "linkMargin": 42.95,
                "category": "Budget Choice",
                "cost": 1241
              }
            ]
          }
        }
      ],
      "headers": {},
      "statusCode": 200
    }
  }
]

## Field Mapping (OLD → NEW)
- `viable_kits` → `recommendedKits`
- `kit.name` → `kit.KIT`
- `kit.cost` → `kit["Cost (USD)"]`
- `kit.radio` → `kit.radios[0].Radio`
- `kit.link_margin` → `kit.radios[0].LinkMargin_dB`
- `high_reliability_recommendation` → `summary.bestTechnicalPerformance.KIT`
- `best_value_recommendation` → `summary.bestValue.KIT`

## New Fields to Display
- `technicalScore` (0-10 rating)
- `valueAnalysis.valueScore` (0-10 rating)
- `recommendation.category` (badge)
- `radios[0].linkAnalysis.quality` (color-coded)