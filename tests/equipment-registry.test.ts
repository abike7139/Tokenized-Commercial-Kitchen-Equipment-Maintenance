import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock contract calls since we can't use the actual Clarity libraries
const mockEquipmentRegistry = {
  data: new Map(),
  owners: new Map(),
  nextId: 1,
  
  registerEquipment: vi.fn((sender, type, model, serial, installDate, warranty) => {
    const id = mockEquipmentRegistry.nextId
    
    // Store equipment data
    mockEquipmentRegistry.data.set(id, {
      owner: sender,
      "equipment-type": type,
      model: model,
      "serial-number": serial,
      "installation-date": installDate,
      "warranty-expiry": warranty,
      "last-service-date": 0,
    })
    
    // Update owner's equipment count
    const currentCount = mockEquipmentRegistry.owners.get(sender) || 0
    mockEquipmentRegistry.owners.set(sender, currentCount + 1)
    
    // Increment ID
    mockEquipmentRegistry.nextId++
    
    return { success: true, value: id }
  }),
  
  updateEquipmentDetails: vi.fn((sender, id, type, model, serial, installDate, warranty) => {
    if (!mockEquipmentRegistry.data.has(id)) {
      return { success: false, error: "ERR-NOT-FOUND" }
    }
    
    const equipment = mockEquipmentRegistry.data.get(id)
    if (equipment.owner !== sender) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    // Update equipment data
    mockEquipmentRegistry.data.set(id, {
      ...equipment,
      "equipment-type": type,
      model: model,
      "serial-number": serial,
      "installation-date": installDate,
      "warranty-expiry": warranty,
    })
    
    return { success: true, value: true }
  }),
  
  transferEquipmentOwnership: vi.fn((sender, id, newOwner) => {
    if (!mockEquipmentRegistry.data.has(id)) {
      return { success: false, error: "ERR-NOT-FOUND" }
    }
    
    const equipment = mockEquipmentRegistry.data.get(id)
    if (equipment.owner !== sender) {
      return { success: false, error: "ERR-NOT-AUTHORIZED" }
    }
    
    // Update equipment owner
    mockEquipmentRegistry.data.set(id, {
      ...equipment,
      owner: newOwner,
    })
    
    // Update owner counts
    const oldOwnerCount = mockEquipmentRegistry.owners.get(sender)
    const newOwnerCount = mockEquipmentRegistry.owners.get(newOwner) || 0
    
    mockEquipmentRegistry.owners.set(sender, oldOwnerCount - 1)
    mockEquipmentRegistry.owners.set(newOwner, newOwnerCount + 1)
    
    return { success: true, value: true }
  }),
  
  getEquipmentDetails: vi.fn((id) => {
    if (!mockEquipmentRegistry.data.has(id)) {
      return { success: true, value: null }
    }
    return { success: true, value: mockEquipmentRegistry.data.get(id) }
  }),
  
  getOwnerEquipmentCount: vi.fn((owner) => {
    return { success: true, value: mockEquipmentRegistry.owners.get(owner) || 0 }
  }),
  
  updateLastServiceDate: vi.fn((id, serviceDate) => {
    if (!mockEquipmentRegistry.data.has(id)) {
      return { success: false, error: "ERR-NOT-FOUND" }
    }
    
    const equipment = mockEquipmentRegistry.data.get(id)
    
    // Update last service date
    mockEquipmentRegistry.data.set(id, {
      ...equipment,
      "last-service-date": serviceDate,
    })
    
    return { success: true, value: true }
  }),
  
  // Reset for tests
  reset: () => {
    mockEquipmentRegistry.data.clear()
    mockEquipmentRegistry.owners.clear()
    mockEquipmentRegistry.nextId = 1
  },
}

describe("Equipment Registry Contract", () => {
  beforeEach(() => {
    mockEquipmentRegistry.reset()
  })
  
  it("should register new equipment", () => {
    const sender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    const result = mockEquipmentRegistry.registerEquipment(
        sender,
        "Refrigerator",
        "CoolMax 5000",
        "SN12345678",
        1620000000,
        1720000000,
    )
    
    expect(result.success).toBe(true)
    expect(result.value).toBe(1)
    
    // Verify the equipment was registered correctly
    const details = mockEquipmentRegistry.getEquipmentDetails(1)
    expect(details.success).toBe(true)
    expect(details.value.owner).toBe(sender)
    expect(details.value["equipment-type"]).toBe("Refrigerator")
    expect(details.value.model).toBe("CoolMax 5000")
    
    // Verify owner's equipment count was updated
    const ownerCount = mockEquipmentRegistry.getOwnerEquipmentCount(sender)
    expect(ownerCount.success).toBe(true)
    expect(ownerCount.value).toBe(1)
  })
  
  it("should update equipment details", () => {
    const sender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    
    // First register the equipment
    mockEquipmentRegistry.registerEquipment(
        sender,
        "Refrigerator",
        "CoolMax 5000",
        "SN12345678",
        1620000000,
        1720000000,
    )
    
    // Now update it
    const result = mockEquipmentRegistry.updateEquipmentDetails(
        sender,
        1,
        "Refrigerator",
        "CoolMax 6000", // Updated model
        "SN12345678",
        1620000000,
        1730000000, // Updated warranty
    )
    
    expect(result.success).toBe(true)
    
    // Verify the equipment was updated correctly
    const details = mockEquipmentRegistry.getEquipmentDetails(1)
    expect(details.value.model).toBe("CoolMax 6000")
    expect(details.value["warranty-expiry"]).toBe(1730000000)
  })
  
  it("should reject unauthorized equipment updates", () => {
    const owner = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    const attacker = "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTABCDE"
    
    // Register equipment as owner
    mockEquipmentRegistry.registerEquipment(owner, "Refrigerator", "CoolMax 5000", "SN12345678", 1620000000, 1720000000)
    
    // Try to update as attacker
    const result = mockEquipmentRegistry.updateEquipmentDetails(
        attacker,
        1,
        "Refrigerator",
        "Hacked Model",
        "SN12345678",
        1620000000,
        1720000000,
    )
    
    expect(result.success).toBe(false)
    expect(result.error).toBe("ERR-NOT-AUTHORIZED")
    
    // Verify the equipment was not updated
    const details = mockEquipmentRegistry.getEquipmentDetails(1)
    expect(details.value.model).toBe("CoolMax 5000")
  })
  
  it("should transfer equipment ownership", () => {
    const originalOwner = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    const newOwner = "ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTABCDE"
    
    // Register equipment
    mockEquipmentRegistry.registerEquipment(
        originalOwner,
        "Refrigerator",
        "CoolMax 5000",
        "SN12345678",
        1620000000,
        1720000000,
    )
    
    // Transfer ownership
    const result = mockEquipmentRegistry.transferEquipmentOwnership(originalOwner, 1, newOwner)
    
    expect(result.success).toBe(true)
    
    // Verify the ownership was transferred
    const details = mockEquipmentRegistry.getEquipmentDetails(1)
    expect(details.value.owner).toBe(newOwner)
    
    // Verify equipment counts were updated for both owners
    const originalOwnerCount = mockEquipmentRegistry.getOwnerEquipmentCount(originalOwner)
    const newOwnerCount = mockEquipmentRegistry.getOwnerEquipmentCount(newOwner)
    
    expect(originalOwnerCount.value).toBe(0)
    expect(newOwnerCount.value).toBe(1)
  })
  
  it("should update last service date", () => {
    const owner = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
    const serviceDate = 1630000000
    
    // Register equipment
    mockEquipmentRegistry.registerEquipment(owner, "Refrigerator", "CoolMax 5000", "SN12345678", 1620000000, 1720000000)
    
    // Update last service date
    const result = mockEquipmentRegistry.updateLastServiceDate(1, serviceDate)
    
    expect(result.success).toBe(true)
    
    // Verify the service date was updated
    const details = mockEquipmentRegistry.getEquipmentDetails(1)
    expect(details.value["last-service-date"]).toBe(serviceDate)
  })
})
