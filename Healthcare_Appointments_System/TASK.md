# Standard End-to-End Workflow for Healthcare Appointments

The standard workflow for comprehensive healthcare appointments in a modern medical system is built upon international data interoperability standards (HL7 FHIR) and practical operational management rules. Below are the detailed phases of this lifecycle.

### 1. Discovery & Proposed 
The process begins when a patient searches for doctors, specialties, or medical services on the portal. The system queries available time slots that are currently in a `FREE` state based on the doctors' working schedules. When a patient selects a specific time slot, the system generates an `Appointment` request with a `proposed` status. Immediately, a Slot Locking mechanism is activated to temporarily hold the spot. This ensures that double-booking is prevented while the patient is actively filling out their information or processing the payment.

### 2. Payment & Booked 
To secure the commitment, patients are generally required to pay the hospital fees in advance or make a partial deposit, such as 30% of the examination package value, at the time of booking. The selected time slot is typically held for a specific duration (e.g., 15 minutes) pending a successful financial transfer. Furthermore, the system can integrate with health insurance providers for Coverage and Claim verification to review fee guarantees. Upon successful payment, the appointment officially transitions to the `booked` status, and the corresponding time slot is updated to a `BUSY` state. To minimize the no-show rate, the system establishes a multi-tiered automated notification sequence, sending reminders via Email at intervals such as 24 hours and 2 hours prior to the visit.

### 3. Reschedule 
The rescheduling process operates as a formal "Re-negotiation" combined with strict financial regulations. When a patient or doctor submits a `proposedNewTime`, the requester's status changes to `tentative` while the other party's status becomes `needs-action`. The new schedule is only finalized as `booked` when all parties mark it as `accepted`. Concurrently, the previously held time slot is immediately released back to the `FREE` state. At this point, the Smart Waitlist feature automatically triggers notifications to patients currently in the queue, suggesting they fill the newly available spot, thereby optimizing clinic revenue.

### 4. Cancellation & Refund 
If either party rejects the rescheduling proposal (`declined`) or the patient proactively cancels the visit, the overall appointment status changes to `cancelled`, returning the time slot to the `FREE` state. In cases where the patient does not show up without any prior notice, the system automatically records the event as a `noshow`. The `cancellationReason` is consistently logged for all cancelled appointments to facilitate accurate financial reconciliation.

---

### Financial & Penalty Regulations
Financial policies regarding rescheduling and cancellations are enforced automatically by the system to compensate for operational disruptions and revenue loss.

| Scenario | Timeframe | Associated Fees & Penalties |
| :--- | :--- | :--- |
| **Reschedule (1st time)** | Prior to 48 hours | Waived (Free of charge). |
| **Reschedule (Subsequent)** | Prior to 48 hours | Additional surcharges applied per policy. |
| **Early Cancellation** | Prior to 48 hours | Patient incurs a cancellation fee (e.g., 30% of deposit); the remainder is refunded. |
| **Late Reschedule** | Within 48 hours | System automatically applies a penalty (e.g., deducting 30% of the deposit). |
| **Late Cancel / No-Show** | Within 48 hours / Missed | Patient forfeits 100% of the deposit with no refund to cover operational losses. |

---

### 5. Arrived & Encounter 
On the day of the appointment, the patient utilizes a QR code on their smartphone to scan at the reception desk or a self-service Kiosk. This action instantly changes the appointment status to `arrived`, effectively bypassing cumbersome paperwork and streamlining the check-in process. This event also triggers the creation of an `Encounter` record within the hospital's information system (HIS/EMR). The doctor uses this record to begin professional clinical monitoring, order laboratory tests, or prescribe medication. Should any new subclinical services arise during the visit, the patient is required to pay additional fees at the counter or via the mobile application before those services are executed.

### 6. Fulfilled & Post-visit 
After the medical consultation concludes, the appointment officially transitions to the `fulfilled` status. The system then automatically dispatches a service quality survey to collect patient Ratings and Reviews for customer care purposes. Patients can securely log into the Patient Portal to access their comprehensive Electronic Health Record (EHR), which includes test results, prescriptions, and vital signs. Simultaneously, the system will proactively suggest or automatically schedule a follow-up appointment if there is a specific clinical indication from the attending doctor.