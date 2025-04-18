;; Equipment Registration Contract
;; Records details of food service systems

(define-data-var contract-owner principal tx-sender)

;; Data structures
(define-map equipment-registry
  { equipment-id: uint }
  {
    owner: principal,
    equipment-type: (string-utf8 64),
    model: (string-utf8 64),
    serial-number: (string-utf8 64),
    installation-date: uint,
    warranty-expiry: uint,
    last-service-date: uint
  }
)

(define-map equipment-owners
  { owner: principal }
  { equipment-count: uint }
)

(define-data-var next-equipment-id uint u1)

;; Error constants
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-ALREADY-REGISTERED (err u101))
(define-constant ERR-NOT-FOUND (err u102))

;; Public functions
(define-public (register-equipment
                (equipment-type (string-utf8 64))
                (model (string-utf8 64))
                (serial-number (string-utf8 64))
                (installation-date uint)
                (warranty-expiry uint))
  (let ((equipment-id (var-get next-equipment-id))
        (current-count (default-to u0 (get equipment-count
                                          (map-get? equipment-owners { owner: tx-sender })))))

    ;; Register the equipment
    (map-set equipment-registry
      { equipment-id: equipment-id }
      {
        owner: tx-sender,
        equipment-type: equipment-type,
        model: model,
        serial-number: serial-number,
        installation-date: installation-date,
        warranty-expiry: warranty-expiry,
        last-service-date: u0
      }
    )

    ;; Update owner's equipment count
    (map-set equipment-owners
      { owner: tx-sender }
      { equipment-count: (+ current-count u1) }
    )

    ;; Increment the equipment ID counter
    (var-set next-equipment-id (+ equipment-id u1))

    ;; Return the equipment ID
    (ok equipment-id)
  )
)

(define-public (update-equipment-details
                (equipment-id uint)
                (equipment-type (string-utf8 64))
                (model (string-utf8 64))
                (serial-number (string-utf8 64))
                (installation-date uint)
                (warranty-expiry uint))
  (let ((equipment-data (unwrap! (map-get? equipment-registry { equipment-id: equipment-id })
                                 (err ERR-NOT-FOUND))))

    ;; Check if the caller is the equipment owner
    (asserts! (is-eq (get owner equipment-data) tx-sender) (err ERR-NOT-AUTHORIZED))

    ;; Update the equipment details
    (map-set equipment-registry
      { equipment-id: equipment-id }
      (merge equipment-data
        {
          equipment-type: equipment-type,
          model: model,
          serial-number: serial-number,
          installation-date: installation-date,
          warranty-expiry: warranty-expiry
        }
      )
    )

    (ok true)
  )
)

(define-public (transfer-equipment-ownership
                (equipment-id uint)
                (new-owner principal))
  (let ((equipment-data (unwrap! (map-get? equipment-registry { equipment-id: equipment-id })
                                 (err ERR-NOT-FOUND)))
        (current-owner (get owner equipment-data))
        (old-owner-count (default-to u0
                                     (get equipment-count
                                          (map-get? equipment-owners { owner: current-owner }))))
        (new-owner-count (default-to u0
                                     (get equipment-count
                                          (map-get? equipment-owners { owner: new-owner })))))

    ;; Check if the caller is the equipment owner
    (asserts! (is-eq current-owner tx-sender) (err ERR-NOT-AUTHORIZED))

    ;; Update equipment ownership
    (map-set equipment-registry
      { equipment-id: equipment-id }
      (merge equipment-data { owner: new-owner })
    )

    ;; Update old owner's equipment count
    (map-set equipment-owners
      { owner: current-owner }
      { equipment-count: (- old-owner-count u1) }
    )

    ;; Update new owner's equipment count
    (map-set equipment-owners
      { owner: new-owner }
      { equipment-count: (+ new-owner-count u1) }
    )

    (ok true)
  )
)

(define-read-only (get-equipment-details (equipment-id uint))
  (map-get? equipment-registry { equipment-id: equipment-id })
)

(define-read-only (get-owner-equipment-count (owner principal))
  (default-to u0 (get equipment-count (map-get? equipment-owners { owner: owner })))
)

;; Update the last service date - can be called by service scheduler contract
(define-public (update-last-service-date (equipment-id uint) (service-date uint))
  (let ((equipment-data (unwrap! (map-get? equipment-registry { equipment-id: equipment-id })
                                 (err ERR-NOT-FOUND))))

    ;; Update the last service date
    (map-set equipment-registry
      { equipment-id: equipment-id }
      (merge equipment-data { last-service-date: service-date })
    )

    (ok true)
  )
)
